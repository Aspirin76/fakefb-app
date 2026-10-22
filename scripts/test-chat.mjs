/**
 * FakeBook 聊天功能端到端測試
 *
 * 流程：登入 -> 取得對話 -> 送訊息給 NPC -> 確認有回覆
 * 用法：先開好 npm run dev，再執行 npm run test:chat
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL ?? "demo@fakefb.test";
const PASSWORD = process.env.TEST_PASSWORD ?? "password123";

const DECODE = { "&quot;": '"', "&#39;": "'", "&amp;": "&", "&lt;": "<", "&gt;": ">" };

function decodeEntities(str) {
  return str.replace(/&(quot|#39|amp|lt|gt);/g, (m) => DECODE[m]);
}

function hiddenInputs(html) {
  const fields = {};
  const pattern = /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\s*\/>/g;
  for (const match of html.matchAll(pattern)) {
    const [, name, raw] = match;
    fields[name] = raw ? decodeEntities(raw) : "";
  }
  return fields;
}

function assert(condition, message) {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✓ ${message}`);
  return true;
}

console.log(`\n=== FakeBook 聊天測試 (${BASE}) ===\n`);

// 1. 登入
console.log("1) 登入");
const loginPage = await fetch(`${BASE}/login`);
const form = new FormData();
for (const [key, value] of Object.entries(hiddenInputs(await loginPage.text()))) {
  form.append(key, value);
}
form.append("email", EMAIL);
form.append("password", PASSWORD);

const loginRes = await fetch(`${BASE}/login`, {
  method: "POST",
  body: form,
  redirect: "manual",
  headers: { origin: BASE },
});
const cookie = loginRes.headers.getSetCookie?.().map((c) => c.split(";")[0]).join("; ") ?? "";
assert(loginRes.status === 303, `登入成功（HTTP ${loginRes.status}）`);
assert(cookie.includes("fakefb_session"), "取得 session cookie");

// 2. 取得對話清單
console.log("\n2) 取得對話清單");
const chatRes = await fetch(`${BASE}/chat`, { headers: { cookie } });
const chatHtml = await chatRes.text();
assert(chatRes.status === 200, `開啟 /chat 成功（HTTP ${chatRes.status}）`);

const conversationIds = [...chatHtml.matchAll(/href="\/chat\/([^"]+)"/g)].map((m) => m[1]);
assert(conversationIds.length > 0, `找到 ${conversationIds.length} 段 NPC 對話`);

const conversationId = conversationIds[0];
console.log(`   使用對話：${conversationId}`);

// 3. 送訊息給 NPC
console.log("\n3) 送訊息給 NPC（會呼叫 OpenCode，可能要等幾秒）");
const started = Date.now();
const sendRes = await fetch(`${BASE}/api/chat/${conversationId}/messages`, {
  method: "POST",
  headers: { cookie, "Content-Type": "application/json" },
  body: JSON.stringify({ content: "哈囉！你是誰呀？自我介紹一下。" }),
});
const sendBody = await sendRes.json();
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

assert(sendRes.status === 200, `NPC 回覆成功（HTTP ${sendRes.status}，耗時 ${elapsed}s）`);
if (sendBody.error) {
  console.error(`   錯誤：${sendBody.error}`);
}
assert(Boolean(sendBody.npcMessage?.content), "有拿到 NPC 的回覆內容");
assert(
  Boolean(sendBody.userMessage?.content),
  "使用者訊息有存進資料庫",
);

if (sendBody.npcMessage?.content) {
  console.log(`\n   NPC 回覆：${sendBody.npcMessage.content}`);
}

// 4. 確認訊息有出現在頁面上
console.log("\n4) 重新整理對話頁");
const threadRes = await fetch(`${BASE}/chat/${conversationId}`, { headers: { cookie } });
const threadHtml = await threadRes.text();
assert(threadRes.status === 200, `開啟對話頁成功（HTTP ${threadRes.status}）`);
assert(
  threadHtml.includes("你是誰呀"),
  "對話頁看得到剛剛送出的訊息",
);

console.log("\n=== 測試結束 ===\n");
