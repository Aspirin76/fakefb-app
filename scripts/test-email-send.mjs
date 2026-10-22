/**
 * 真的寄一封信出來的測試
 *
 * 用 Resend 的測試收件匣 delivered@resend.dev 當註冊信箱，
 * 跑一次註冊，確認：
 *   - 沒有出現 &dev= 參數 → 代表真的有呼叫 Resend API 並成功
 *   - Resend 回應 200
 *
 * 用法：先開好 npm run dev，再執行 npm run test:email
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TEST_INBOX = process.env.TEST_INBOX ?? "delivered@resend.dev";

function hiddenInputs(html) {
  const fields = {};
  const pattern = /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\s*\/>/g;
  for (const match of html.matchAll(pattern)) {
    const [, name, raw] = match;
    fields[name] = raw
      ? raw
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
      : "";
  }
  return fields;
}

const page = await fetch(`${BASE}/register`);
const form = new FormData();
for (const [key, value] of Object.entries(hiddenInputs(await page.text()))) {
  form.append(key, value);
}
form.append("name", "寄信測試");
form.append("email", TEST_INBOX);
form.append("password", "password123");

const res = await fetch(`${BASE}/register`, {
  method: "POST",
  body: form,
  redirect: "manual",
  headers: { origin: BASE },
});

const location = res.headers.get("location") ?? "";
const html = await res.text();

console.log(`HTTP ${res.status}`);
console.log(`Location: ${location}`);

if (location.includes("&dev=")) {
  console.error("\n✗ 還是開發模式，沒有真的寄信。請檢查 .env 的 RESEND_API_KEY。");
  process.exit(1);
}

if (res.status === 303 && location.startsWith("/check-email")) {
  console.log("\n✓ 註冊成功，驗證信已交給 Resend 寄送（沒有出現 dev 參數）");
  console.log(`  收件匣：${TEST_INBOX}`);
  console.log("  可以到 https://resend.com/emails 查看這封信的內容與投遞狀態。");
} else {
  console.error("\n✗ 註冊失敗：");
  console.error(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 500));
  process.exit(1);
}
