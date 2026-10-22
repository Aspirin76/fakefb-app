/**
 * FakeBook 端到端煙霧測試
 *
 * 會依序測試：
 *   1. 註冊 -> 產生驗證信
 *   2. 用驗證連結完成 Email 驗證
 *   3. 登入 -> 拿到 session cookie
 *   4. 帶 cookie 造訪 /feed -> 200
 *   5. 重複使用同一組 token -> 應該失敗
 *   6. 未驗證的帳號不能登入
 *   7. 重複註冊 -> 被擋下來
 *   8. 發貼 -> 動態牆看得到
 *
 * 驗證連結是從開發信箱記錄檔（dev-mails.log）取得的，
 * 所以不管目前是「沒設定金鑰的開發模式」還是「真的寄信」都能測。
 *
 * 用法：先開好 `npm run dev`，再執行 `npm run test:smoke`
 */
import { readFileSync, existsSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// Resend 的沙盒只接受 resend.dev 的測試信箱，example.com 會被擋掉。
// 用 plus-addressing 讓每次測試都是全新的信箱，不會撞到資料庫的唯一性限制。
const stamp = Date.now();
const email = `delivered+smoke${stamp}@resend.dev`;
const email2 = `delivered+pending${stamp}@resend.dev`;
const password = "password123";

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

async function submitForm(path, extra = {}) {
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

/** 從開發信箱記錄檔（dev-mails.log）找出某個收件人最近的驗證連結 */
function findVerifyLink(mailbox) {
  const log = "dev-mails.log";
  if (!existsSync(log)) return null;

  const blocks = readFileSync(log, "utf8").split(/={10,}/).filter(Boolean);

  for (const block of blocks.reverse()) {
    if (!block.includes(`收件人: ${mailbox}`)) continue;
    const match = block.match(/驗證連結:\s*(\S+)/);
    if (match) return match[1];
  }

  return null;
}

console.log(`\n=== FakeBook 煙霧測試 (${BASE}) ===\n`);

// 1. 註冊
console.log("1) 註冊");
const register = await submitForm("/register", { name: "測試小明", email, password });
assert(register.status === 303, `註冊成功（HTTP ${register.status}）`);
assert(
  (register.location ?? "").startsWith("/check-email"),
  `導向到 check-email（${register.location}）`,
);

// 2. 取得驗證連結並完成驗證
console.log("\n2) Email 驗證");
const verifyLink = findVerifyLink(email);
assert(Boolean(verifyLink), "開發信箱記錄檔找得到驗證連結");

if (verifyLink) {
  const token = new URL(verifyLink).searchParams.get("token");
  const verify = await fetchPage(`/verify-email?token=${encodeURIComponent(token)}`);
  assert(verify.html.includes("驗證成功"), "驗證連結 -> 顯示驗證成功");

  // 5. token 只能使用一次
  console.log("\n3) token 只能使用一次");
  const again = await fetchPage(`/verify-email?token=${encodeURIComponent(token)}`);
  assert(!again.html.includes("驗證成功"), "重複使用同一組 token 會失敗");
} else {
  process.exitCode = 1;
}

// 4. 登入
console.log("\n4) 登入");
const login = await submitForm("/login", { email, password });
assert(login.status === 303, `登入成功（HTTP ${login.status}）`);
assert((login.location ?? "") === "/feed", `登入後導向 /feed（${login.location}）`);

const cookie = login.setCookie.map((c) => c.split(";")[0]).join("; ");
assert(cookie.includes("fakefb_session"), "取得 session cookie");

// 5. 帶 cookie 造訪 /feed
console.log("\n5) 動態牆");
const feed = await fetch(`${BASE}/feed`, {
  headers: { cookie },
  redirect: "manual",
});
assert(feed.status === 200, `造訪 /feed 成功（HTTP ${feed.status}）`);
assert((await feed.text()).includes("測試小明"), "動態牆顯示已登入的使用者");

// 6. 還沒驗證 Email 就不准登入
console.log("\n6) 未驗證不能登入");
await submitForm("/register", { name: "未驗證者", email: email2, password });
const login2 = await submitForm("/login", { email: email2, password });
assert(login2.status === 200, "未驗證的帳號登入會被擋下（HTTP 200 = 表單回應錯誤訊息）");
assert(login2.html.includes("Email 還沒驗證"), "顯示尚未驗證的錯誤訊息");
assert(login2.html.includes("搜尋FakeBook"), "錯誤訊息頁的 navbar 沒有壞掉");

// 7. 重複註冊
console.log("\n7) 重複註冊");
const dup = await submitForm("/register", { name: "重複", email, password });
assert(dup.status === 200, "重複註冊會被擋下");
assert(dup.html.includes("已經註冊過"), "顯示 Email 已經註冊過");
assert(dup.html.includes("搜尋FakeBook"), "錯誤訊息頁的 navbar 沒有壞掉");

// 8. 發貼
console.log("\n8) 發貼");
const composerPage = await fetch(`${BASE}/feed`, { headers: { cookie } });
const composerFields = hiddenInputs(await composerPage.text());
const postForm = new FormData();
for (const [key, value] of Object.entries(composerFields)) {
  if (key.startsWith("$ACTION")) postForm.append(key, value);
}
postForm.append("content", "哈囉，FakeBook！這是第一篇測試貼文。");
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
