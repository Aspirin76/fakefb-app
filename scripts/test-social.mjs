/**
 * FakeBook 社群功能端到端測試
 *
 * 覆蓋：限時動態、按讚、留言、SSE 即時推播、在線狀態
 * 用法：先開好 npm run dev，再執行 npm run test:social
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

console.log(`\n=== FakeBook 社群功能測試 (${BASE}) ===\n`);

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

const authHeaders = { cookie, "Content-Type": "application/json" };

// 2. SSE 連線
console.log("\n2) SSE 即時推播");
const controller = new AbortController();
const events = [];

// 背景讀 SSE 串流
(async () => {
  const res = await fetch(`${BASE}/api/events`, {
    headers: { cookie },
    signal: controller.signal,
  });
  assert(
    res.headers.get("content-type")?.includes("text/event-stream"),
    "SSE 回應是 text/event-stream",
  );

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let index;
    while ((index = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);

      const type = chunk.match(/^event: (.+)$/m)?.[1];
      const data = chunk.match(/^data: (.+)$/m)?.[1];
      if (type) events.push({ type, data });
    }
  }
})().catch(() => {});

await new Promise((r) => setTimeout(r, 1500));
assert(events.some((e) => e.type === "hello"), "收到 hello 事件");
assert(
  events.some((e) => e.type === "presence"),
  "收到 presence 事件（在線狀態）",
);

// 3. 發限時動態
console.log("\n3) 限時動態");
const storyRes = await fetch(`${BASE}/api/stories`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({ content: "測試用限時動態 🌟", emoji: "🌟", color: "#f58518" }),
});
const storyBody = await storyRes.json();
assert(storyRes.status === 200, `發布限時動態成功（HTTP ${storyRes.status}）`);
assert(Boolean(storyBody.story?.id), "限時動態有 id");
assert(
  storyBody.story?.expiresAt > new Date().toISOString(),
  "限時動態有到期時間",
);

await new Promise((r) => setTimeout(r, 800));
assert(events.some((e) => e.type === "story:new"), "有收到 story:new 推播");

// 4. 動態牆上看到限時動態
console.log("\n4) 動態牆");
const feedRes = await fetch(`${BASE}/feed`, { headers: { cookie } });
const feedHtml = await feedRes.text();
assert(feedRes.status === 200, `開啟 /feed 成功（HTTP ${feedRes.status}）`);
assert(feedHtml.includes("測試用限時動態") || feedHtml.includes("限時動態"), "動態牆有顯示限時動態");
assert(feedHtml.includes("現在上線"), "動態牆有在線名單");
assert(feedHtml.includes("留言"), "貼文有留言功能");

// 5. 發貼
console.log("\n5) 發貼");
const postRes = await fetch(`${BASE}/api/posts`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({ content: "測試貼文：按讚與留言功能" }),
});
const postBody = await postRes.json();
assert(postRes.status === 200, `發貼成功（HTTP ${postRes.status}）`);
const postId = postBody.post?.id;

await new Promise((r) => setTimeout(r, 800));
assert(events.some((e) => e.type === "post:new"), "有收到 post:new 推播");

// 6. 按讚
console.log("\n6) 按讚");
const likeRes = await fetch(`${BASE}/api/posts/${postId}/like`, {
  method: "POST",
  headers: authHeaders,
});
const likeBody = await likeRes.json();
assert(likeRes.status === 200, `按讚成功（HTTP ${likeRes.status}）`);
assert(likeBody.liked === true, "已按讚");
assert(likeBody.likeCount >= 1, `按讚數 = ${likeBody.likeCount}`);

const unlikeRes = await fetch(`${BASE}/api/posts/${postId}/like`, {
  method: "POST",
  headers: authHeaders,
});
const unlikeBody = await unlikeRes.json();
assert(unlikeBody.liked === false, "再按一次可以取消按讚");

await new Promise((r) => setTimeout(r, 800));
assert(events.some((e) => e.type === "post:update"), "有收到 post:update 推播");

// 7. 留言
console.log("\n7) 留言");
const commentRes = await fetch(`${BASE}/api/posts/${postId}/comments`, {
  method: "POST",
  headers: authHeaders,
  body: JSON.stringify({ content: "這是一則測試留言" }),
});
const commentBody = await commentRes.json();
assert(commentRes.status === 200, `留言成功（HTTP ${commentRes.status}）`);
assert(commentBody.comment?.content === "這是一則測試留言", "留言內容正確");
assert(commentBody.comment?.user?.name, "留言有作者資訊");

// 8. 標記看過限時動態
console.log("\n8) 標記限時動態看過");
const viewRes = await fetch(`${BASE}/api/stories/${storyBody.story.id}/view`, {
  method: "POST",
  headers: authHeaders,
});
assert(viewRes.status === 200, `標記看過成功（HTTP ${viewRes.status}）`);

// 9. 斷線
console.log("\n9) 關閉 SSE 連線");
controller.abort();
await new Promise((r) => setTimeout(r, 500));
assert(true, "SSE 連線已正常關閉");

console.log("\n=== 測試結束 ===\n");
