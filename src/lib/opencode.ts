import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * FakeBook 的 NPC 聊天引擎 —— 以 OpenCode 當作 LLM 引擎。
 *
 * 運作方式：
 *   1. 連到本機的 OpenCode 背景服務（Service.ensure() 會自動發現／啟動）
 *   2. 每段對話有自己的 OpenCode 工作目錄與專屬 agent（人設寫在 system prompt）
 *   3. 每段對話對應一個 OpenCode session，所以可以記住前面的內容
 *   4. 送出訊息後輪詢訊息列表，等 AI 的文字回覆
 */

const AGENT_ID = "fakebook-npc";

/** 參與對話的 NPC */
export type NpcProfile = {
  id: string;
  name: string;
  color?: string;
  handle?: string;
  persona: string;
};

type OpencodeClient = ReturnType<typeof OpenCode.make>;

let clientPromise: Promise<OpencodeClient> | null = null;

/** 取得（並快取）OpenCode client */
async function getClient(): Promise<OpencodeClient> {
  clientPromise ??= (async () => {
    const endpoint = await Service.ensure();
    return OpenCode.make({
      baseUrl: endpoint.url,
      headers: Service.headers(endpoint),
    });
  })();

  return clientPromise;
}

/** 解析 OPENCODE_MODEL，格式為 provider/model */
function getModel() {
  const raw = (process.env.OPENCODE_MODEL ?? "opencode/minimax-m3.1-flash-free").trim();
  const [providerID, ...rest] = raw.split("/");
  return {
    providerID: providerID || "opencode",
    modelID: rest.join("/") || "minimax-m3.1-flash-free",
  };
}

/** 把人設寫成 agent 的 system prompt */
function buildSystemPrompt(npcs: NpcProfile[], isGroup: boolean) {
  if (!isGroup) {
    const npc = npcs[0];
    // 注意：prompt 裡盡量不要出現「工具」「設定」「系統」這類字，
    // 小模型看到反而會把這些字講出來，就不像在聊天了。
    return [
      `你是 FakeBook 社群網站上的好友「${npc.name}」，現在正在跟一位朋友傳訊息聊天。`,
      "",
      "【個性】",
      npc.persona,
      "",
      "【說話方式】",
      "- 像真人用 Messenger 打字那樣自然。",
      "- 回覆 1~2 句就夠，通常 60 個字以內。",
      "- 可以用口語詞，例如「哈」「欸」「啦」「😊」。",
      "- 不要用條列、不要用 Markdown、不要貼長文。",
    ].join("\n");
  }

  return [
    "你是 FakeBook 上一個群組聊天裡的幾位好友，現在正在跟一位朋友聊天。",
    "",
    "【群組成員】",
    ...npcs.map((npc) => `- ${npc.name}：${npc.persona.replace(/\n/g, " ")}`),
    "",
    "【說話方式】",
    "- 每則訊息一行，開頭寫說話的人的名字，格式：「名字：內容」。",
    "- 一個回合最多 2~3 行，可以只有一個人回話。",
    "- 每則內容 1~2 句、60 字以內，像真人打字。",
    "- 可以用口語詞，例如「哈」「欸」「啦」「😊」。",
    "- 不要用條列、不要用 Markdown、不要貼長文。",
    "- 絕對不要多寫解釋或標題，只有「名字：內容」這樣的訊息。",
  ].join("\n");
}

/**
 * 角色設定的指紋。
 * 人設或 prompt 有改的時候，指紋會變，對話就會開新的 OpenCode session。
 */
export function npcSignature(npcs: NpcProfile[], isGroup: boolean) {
  return createHash("sha256")
    .update(buildSystemPrompt(npcs, isGroup))
    .digest("hex")
    .slice(0, 16);
}

/** 對話專屬的 OpenCode 工作目錄 */
function npcWorkspaceDir(signature: string) {
  const base =
    process.env.OPENCODE_NPC_DIR?.trim() || join(tmpdir(), "fakebook-npc");
  return join(base, signature);
}

/**
 * 確保工作目錄存在，且裡面的 opencode.json 已經寫好這個對話的 agent。
 */
function ensureNpcWorkspace(npcs: NpcProfile[], isGroup: boolean, signature: string) {
  const dir = npcWorkspaceDir(signature);
  mkdirSync(dir, { recursive: true });

  const file = join(dir, "opencode.json");
  const content = JSON.stringify(
    {
      $schema: "https://opencode.ai/config.json",
      agents: {
        [AGENT_ID]: {
          mode: "primary",
          description: `${npcs.map((n) => n.name).join("、")}（FakeBook 的 NPC 聊天角色）`,
          system: buildSystemPrompt(npcs, isGroup),
        },
      },
    },
    null,
    2,
  );

  if (!existsSync(file) || readFileSync(file, "utf8") !== content) {
    writeFileSync(file, content, "utf8");
  }

  return dir;
}

/** 從錯誤訊息判斷是不是「agent 還沒被載入」 */
function isAgentNotFound(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Agent not found/i.test(message);
}

/**
 * OpenCode free tier 偶爾會暫時性拒絕（額度 / 速率限制），
 * 這種情況重試一下就好。
 */
function isTransientError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /free tier|usage limit|rate limit|逾時|timeout|too many/i.test(message);
}

/**
 * OpenCode 剛寫好 opencode.json 時還沒重新載入設定，
 * 這時建立 session 會找不到 agent。這裡主動等它載入。
 */
async function waitForAgentLoaded(
  client: OpencodeClient,
  dir: string,
  timeoutMs = 15_000,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const { data } = await client.agent.list({
        location: { directory: dir },
      });
      if (data.some((agent) => agent.id === AGENT_ID)) return true;
    } catch {
      // 忽略，繼續重試
    }

    await sleep(600);
  }

  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** OpenCode 回傳的訊息列表（實際型別是 union，這裡取出我們用得到的欄位） */
type OpencodeMessage = {
  id: string;
  type: string;
  content?: Array<{ type: string; text?: string }>;
  finish?: string;
  error?: { message?: string };
  outcome?: string;
};

/** 送出訊息後，輪詢等待「這一輪」新產生的 AI 文字回覆 */
async function waitForReply(
  client: OpencodeClient,
  sessionID: string,
  knownMessageIds: Set<string>,
  timeoutMs = 45_000,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data } = await client.message.list(
      { sessionID },
      { signal: AbortSignal.timeout(10_000) },
    );
    const messages = data as unknown as OpencodeMessage[];

    // 只看這一輪新產生的 assistant 訊息
    const assistant = messages
      .filter((m) => m.type === "assistant" && !knownMessageIds.has(m.id))
      .at(-1);

    if (assistant) {
      const text = (assistant.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("")
        .trim();

      if (text) return text;

      if (assistant.finish === "error" || assistant.error) {
        throw new Error(assistant.error?.message ?? "OpenCode 回覆失敗");
      }
    }

    const idle = messages
      .filter((m) => m.type === "idle" && !knownMessageIds.has(m.id))
      .at(-1);

    if (idle?.outcome === "failed") {
      const message = idle.error?.message ?? "OpenCode 回覆失敗";
      if (isAgentNotFound(message)) {
        throw new Error(`Agent not found: ${AGENT_ID}`);
      }
      throw new Error(message);
    }

    await sleep(700);
  }

  throw new Error("等待 AI 回覆逾時");
}

/** 一則 NPC 的回覆 */
export type NpcReply = {
  senderId: string;
  content: string;
};

/**
 * 把 AI 回覆拆成一個或多則訊息。
 *
 * 群組聊天時 AI 會用「名字：內容」的格式回答，每一行就是不同的人講的。
 */
export function parseReplies(text: string, npcs: NpcProfile[]): NpcReply[] {
  const fallback = npcs[0];
  if (!fallback) return [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const replies: NpcReply[] = [];

  for (const line of lines) {
    // 開頭是某個 NPC 的名字 + 冒號 → 那是那位 NPC 講的
    const match = line.match(/^([^：:]{1,12})\s*[：:]\s*(.+)$/);
    if (match) {
      const [, name, content] = match;
      const speaker = npcs.find(
        (npc) => npc.name === name.trim() || npc.id === name.trim(),
      );
      if (speaker && content.trim()) {
        replies.push({ senderId: speaker.id, content: content.trim() });
        continue;
      }
    }

    replies.push({ senderId: fallback.id, content: line });
  }

  return replies.slice(0, 4);
}

export type NpcReplyResult = {
  sessionId: string;
  replies: NpcReply[];
};

/**
 * 讓 NPC 回覆一句話。
 *
 * @param npcs      參與對話的 NPC（群組聊天時會有多個）
 * @param sessionId 既有的 OpenCode session（沒有就會新建）
 * @param message   使用者說的話
 */
export async function npcReply({
  npcs,
  isGroup,
  sessionId,
  message,
}: {
  npcs: NpcProfile[];
  isGroup: boolean;
  sessionId?: string | null;
  message: string;
}): Promise<NpcReplyResult> {
  const client = await getClient();
  const signature = npcSignature(npcs, isGroup);
  const dir = ensureNpcWorkspace(npcs, isGroup, signature);
  const model = getModel();

  // 等 OpenCode 載入這個對話的 agent 設定
  await waitForAgentLoaded(client, dir);

  // 1. 取得或建立 session
  let activeSessionId: string | null = sessionId ?? null;
  let lastError: unknown;

  const MAX_ATTEMPTS = 3;
  const overallDeadline = Date.now() + 150_000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (Date.now() > overallDeadline) break;

    if (!activeSessionId) {
      const session = await client.session.create(
        {
          agent: AGENT_ID,
          model: { id: model.modelID, providerID: model.providerID },
          location: { directory: dir },
        },
        { signal: AbortSignal.timeout(20_000) },
      );
      activeSessionId = session.id;
    }

    // 記下目前有哪些訊息，等下才認得「這一輪」新產生的回覆
    const before = await client.message.list(
      { sessionID: activeSessionId },
      { signal: AbortSignal.timeout(10_000) },
    );
    const knownMessageIds = new Set(before.data.map((m) => m.id));

    try {
      await client.session.prompt(
        {
          sessionID: activeSessionId,
          text: message,
        },
        // provider 有時候會卡住，給它一個上限
        { signal: AbortSignal.timeout(60_000) },
      );
    } catch (error) {
      if (isAgentNotFound(error)) {
        // 舊 session 綁的 agent 不見了（例如工作目錄被清掉）→ 換新的 session 再試
        lastError = error;
        activeSessionId = null;
        await sleep(800);
        continue;
      }

      if (isTransientError(error) && attempt < MAX_ATTEMPTS - 1) {
        // free tier 暫時性拒絕 → 退避後重試
        lastError = error;
        await sleep(2000 * (attempt + 1));
        continue;
      }

      throw error;
    }

    try {
      if (Date.now() > overallDeadline) break;

      const reply = await waitForReply(client, activeSessionId, knownMessageIds);
      return {
        sessionId: activeSessionId,
        replies: parseReplies(reply, npcs),
      };
    } catch (error) {
      if (isAgentNotFound(error)) {
        lastError = error;
        activeSessionId = null;
        await sleep(800);
        continue;
      }

      if (isTransientError(error) && attempt < MAX_ATTEMPTS - 1) {
        lastError = error;
        await sleep(2000 * (attempt + 1));
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("AI 回覆失敗，請稍後再試一次。");
}

/** 檢查 OpenCode 服務是否連得上 */
export async function checkOpencode() {
  try {
    const client = await getClient();
    const info = await client.server.info();
    return { ok: true, version: info.version };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
