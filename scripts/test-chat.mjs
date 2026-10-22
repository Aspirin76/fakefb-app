/**
 * FakeBook 聊天功能端到端測試
 *
 * 流程：登入 -> 建立對話 -> 送訊息 -> NPC 回覆 -> 回覆引用 / 表情 / 刪除 / 已讀
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

const authHeaders = { cookie, "Content-Type": "application/json" };

// 2. 建立 1 對 1 對話
console.log("\n2) 建立 1 對 1 對話");
const dmRes = await fetch(`${BASE}/api/chat`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({ npcIds: ["npc-kui"] }),
});
const dm = await dmRes.json();
assert(dmRes.status === 200 && dm.conversationId, `建立成功（${dm.conversationId}）`);

// 3. 建立群組對話
console.log("\n3) 建立群組對話");
const groupRes = await fetch(`${BASE}/api/chat`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({ npcIds: ["npc-kui", "npc-zhe"] }),
});
const group = await groupRes.json();
assert(groupRes.status === 200 && group.conversationId, `群組建立成功（${group.conversationId}）`);
assert(group.conversationId !== dm.conversationId, "群組跟 1 對 1 是不同的對話");

// 4. 送訊息給 NPC
console.log("\n4) 送訊息給 NPC（會呼叫 OpenCode，可能要等幾秒）");
const started = Date.now();
const sendRes = await fetch(`${BASE}/api/chat/${dm.conversationId}/messages`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({ content: "哈囉！你是誰呀？自我介紹一下。" }),
});
const sendBody = await sendRes.json();
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

assert(sendRes.status === 200, `NPC 回覆成功（HTTP ${sendRes.status}，耗時 ${elapsed}s）`);
if (sendBody.error) console.error(`   錯誤：${sendBody.error}`);
assert(Boolean(sendBody.npcMessages?.[0]?.content), "有拿到 NPC 的回覆內容");
assert(Boolean(sendBody.userMessage?.id), "使用者訊息有存進資料庫");

if (sendBody.npcMessages?.[0]?.content) {
  console.log(`\n   NPC 回覆：${sendBody.npcMessages[0].content}`);
}

const npcMessageId = sendBody.npcMessages?.[0]?.id;

// 5. 表情回應
console.log("\n5) 表情回應");
const reactRes = await fetch(
  `${BASE}/api/chat/${dm.conversationId}/messages/${npcMessageId}/react`,
  { method: "POST", headers: authHeaders, body: JSON.stringify({ emoji: "👍" }) },
);
const reactBody = await reactRes.json();
assert(reactRes.status === 200, `加上表情成功（HTTP ${reactRes.status}）`);
assert(
  Object.values(reactBody.message?.reactions ?? {}).includes("👍"),
  "表情有存進資料庫",
);

// 6. 回覆引用
console.log("\n6) 回覆引用");
const replyRes = await fetch(`${BASE}/api/chat/${dm.conversationId}/messages`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({ content: "我也想知道耶", replyToId: npcMessageId }),
});
const replyBody = await replyRes.json();
assert(replyRes.status === 200, `帶引用的訊息送出成功（HTTP ${replyRes.status}）`);
assert(replyBody.userMessage?.replyToId === npcMessageId, "引用連結有存進資料庫");

// 7. 刪除自己的訊息
console.log("\n7) 刪除自己的訊息");
const deleteRes = await fetch(
  `${BASE}/api/chat/${dm.conversationId}/messages/${replyBody.userMessage.id}`,
  { method: "DELETE", headers: authHeaders },
);
const deleteBody = await deleteRes.json();
assert(deleteRes.status === 200, `刪除成功（HTTP ${deleteRes.status}）`);
assert(Boolean(deleteBody.message?.deletedAt), "訊息標記為已刪除");

// 8. 已讀
console.log("\n8) 標記已讀");
const readRes = await fetch(`${BASE}/api/chat/${dm.conversationId}/read`, {
  method: "POST",
  headers: authHeaders,
});
assert(readRes.status === 200, `標記已讀成功（HTTP ${readRes.status}）`);

// 9. 群組聊天：AI 會回多則
console.log("\n9) 群組聊天（AI 可能回多則）");
const groupStarted = Date.now();
const groupRes2 = await fetch(`${BASE}/api/chat/${group.conversationId}/messages`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({ content: "你們兩個覺得今天天氣如何？" }),
});
const groupBody = await groupRes2.json();
const groupElapsed = ((Date.now() - groupStarted) / 1000).toFixed(1);
assert(groupRes2.status === 200, `群組回覆成功（HTTP ${groupRes2.status}，耗時 ${groupElapsed}s）`);
if (groupBody.error) console.error(`   錯誤：${groupBody.error}`);
assert(
  Array.isArray(groupBody.npcMessages) && groupBody.npcMessages.length > 0,
  `群組有回覆（${groupBody.npcMessages?.length ?? 0} 則）`,
);
for (const message of groupBody.npcMessages ?? []) {
  console.log(`   - ${message.senderId}: ${message.content}`);
}

// 10. 聊天清單有未讀數
console.log("\n10) 聊天清單");
const chatRes = await fetch(`${BASE}/chat`, { headers: { cookie } });
const chatHtml = await chatRes.text();
assert(chatRes.status === 200, `開啟 /chat 成功（HTTP ${chatRes.status}）`);
assert(chatHtml.includes("新增對話"), "有新增對話的按鈕");
assert(chatHtml.includes("小葵"), "清單上有 NPC");

console.log("\n=== 測試結束 ===\n");
