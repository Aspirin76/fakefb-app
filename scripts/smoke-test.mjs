/**
 * 假FB 端到端煙霧測試
 *
 * 會依序測試：
 *   1. 註冊 -> 產生驗證信（含開發模式的驗證連結）
 *   2. 點驗證連結 -> Email 驗證成功
 *   3. 登入 -> 拿到 session cookie
 *   4. 帶 cookie 造訪 /feed -> 200
 *   5. 重複使用同一組 token -> 應該失敗
 *
 * 用法：先開好 `npm run dev`，再執行 `node scripts/smoke-test.mjs`
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const DECODE = { "&quot;": '"', "&#39;": "'", "&amp;": "&", "&lt;": "<", "&gt;": ">" };

function decodeEntities(str) {
  return str.replace(/&(quot|#39|amp|lt|gt);/g, (m) => DECODE[m]);
}

/** 把 server action 表單裡的 hidden input 抓出來 */
function hiddenInputs(html) {
  const fields = {};
  const pattern = /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\s*\/>/g;
  for (const match of html.matchAll(pattern)) {
    const [, name, rawValue] = match;
    fields[name] = rawValue ? decodeEntities(rawValue) : "";
  }
  return fields;
}

async function fetchPage(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: res.status, html: await res.text(), headers: res.headers };
}

async function submitForm(path, fields, extra = {}) {
  const { html } = await fetchPage(path);
  const form = new FormData();
  for (const [key, value] of Object.entries(hiddenInputs(html))) {
    form.append(key, value);
  }
  for (const [key, value] of Object.entries(extra)) {
    form.append(key, value);
  }

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: form,
    redirect: "manual",
    headers: { origin: BASE },
  });

  return {
    status: res.status,
    location: res.headers.get("location"),
    setCookie: res.headers.getSetCookie?.() ?? [],
    html: await res.text(),
  };
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

const email = `tester${Date.now()}@example.com`;
const password = "password123";

console.log(`\n=== 假FB 煙霧測試 (${BASE}) ===\n`);

// 1. 註冊
console.log("1) 註冊");
const register = await submitForm("/register", {}, { name: "測試小明", email, password });
assert(register.status === 303, `註冊成功（HTTP ${register.status}）`);
assert(
  (register.location ?? "").startsWith("/check-email"),
  `導向到 check-email（${register.location}）`,
);

// 2. 取得驗證連結（開發模式會放在 dev 參數；正式模式則在信箱裡）
console.log("\n2) Email 驗證");
const devParam = new URL(register.location, BASE).searchParams.get("dev");
if (devParam) {
  const verify = await fetchPage(`/verify-email?token=${encodeURIComponent(new URL(devParam).searchParams.get("token"))}`);
  assert(verify.html.includes("驗證成功"), "驗證連結 -> 顯示驗證成功");
} else {
  console.log("· 開發模式沒有 dev 連結（可能真的有寄信），請自行到信箱點連結");
}

// 3. 登入
console.log("\n3) 登入");
const login = await submitForm("/login", {}, { email, password });
assert(login.status === 303, `登入成功（HTTP ${login.status}）`);
assert((login.location ?? "") === "/feed", `登入後導向 /feed（${login.location}）`);

const cookie = login.setCookie.map((c) => c.split(";")[0]).join("; ");
assert(cookie.includes("fakefb_session"), "取得 session cookie");

// 4. 帶 cookie 造訪 /feed
console.log("\n4) 動態牆");
const feed = await fetch(`${BASE}/feed`, {
  headers: { cookie },
  redirect: "manual",
});
assert(feed.status === 200, `造訪 /feed 成功（HTTP ${feed.status}）`);
assert((await feed.text()).includes("測試小明"), "動態牆顯示已登入的使用者");

// 5. 驗證 token 不能重複使用
console.log("\n5) token 只能使用一次");
if (devParam) {
  const token = new URL(devParam).searchParams.get("token");
  const again = await fetchPage(`/verify-email?token=${encodeURIComponent(token)}`);
  assert(!again.html.includes("驗證成功"), "重複使用同一組 token 會失敗");
}

// 6. 還沒驗證 Email 就不准登入
console.log("\n6) 未驗證不能登入");
const email2 = `pending${Date.now()}@example.com`;
const register2 = await submitForm("/register", {}, { name: "未驗證者", email: email2, password });
const devParam2 = new URL(register2.location, BASE).searchParams.get("dev");
if (devParam2) {
  const login2 = await submitForm("/login", {}, { email: email2, password });
  assert(login2.status === 200, "未驗證的帳號登入會被擋下（HTTP 200 = 表單回應錯誤訊息）");
  assert(login2.html.includes("Email 還沒驗證"), "顯示尚未驗證的錯誤訊息");
  assert(login2.html.includes("搜尋假FB"), "錯誤訊息頁的 navbar 沒有壞掉");
}

// 7. 同一組 hidden input 重新送出 -> 註冊 / 登入
console.log("\n7) 重複註冊");
const dup = await submitForm("/register", {}, { name: "重複", email, password });
assert(dup.status === 200, "重複註冊會被擋下");
assert(dup.html.includes("已經註冊過"), "顯示 Email 已經註冊過");
assert(dup.html.includes("搜尋假FB"), "錯誤訊息頁的 navbar 沒有壞掉");

// 8. 發貼
console.log("\n8) 發貼");
const composerPage = await fetch(`${BASE}/feed`, { headers: { cookie } });
const composerFields = hiddenInputs(await composerPage.text());
const postForm = new FormData();
for (const [key, value] of Object.entries(composerFields)) {
  if (key.startsWith("$ACTION")) postForm.append(key, value);
}
postForm.append("content", "哈囉，假FB！這是第一篇測試貼文。");
const postRes = await fetch(`${BASE}/feed`, {
  method: "POST",
  headers: { cookie, origin: BASE },
  body: postForm,
  redirect: "manual",
});
assert(postRes.status === 303 || postRes.status === 200, `發貼送出成功（HTTP ${postRes.status}）`);
const feedAfter = await fetch(`${BASE}/feed`, { headers: { cookie } });
assert((await feedAfter.text()).includes("這是第一篇測試貼文"), "動態牆看得到新貼文");

console.log("\n=== 測試結束 ===\n");
