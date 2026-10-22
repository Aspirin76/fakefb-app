/**
 * 把「貼上-Resend-金鑰.txt」裡的設定同步到 .env
 *
 * 用法：npm run setup:env
 * 流程：開啟「貼上-Resend-金鑰.txt」貼上金鑰 -> 存檔 -> 執行這個指令
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const notePath = join(root, "貼上-Resend-金鑰.txt");
const envPath = join(root, ".env");

if (!existsSync(notePath)) {
  console.error(`找不到 ${notePath}`);
  process.exit(1);
}

const note = readFileSync(notePath, "utf8");

/** 從記事本裡抓 "KEY=value" 的值 */
function pick(key) {
  // 注意：用 [ \t] 而不是 \s，否則 \s 會吃到換行、把下一行也當成值
  const match = note.match(new RegExp(`^${key}[ \\t]*=[ \\t]*(.*)$`, "m"));
  if (!match) return undefined;
  const value = match[1].trim().replace(/^["']|["']$/g, "");
  return value.length > 0 ? value : undefined;
}

const apiKey = pick("RESEND_API_KEY");
const emailFrom = pick("EMAIL_FROM");
const appUrl = pick("APP_URL");

if (!apiKey) {
  console.error(
    "❌ 還沒有填 RESEND_API_KEY。\n" +
      `   請打開「${notePath}」，在 RESEND_API_KEY= 後面貼上你的金鑰再存檔。`,
  );
  process.exit(1);
}

if (!apiKey.startsWith("re_")) {
  console.error("❌ RESEND_API_KEY 的格式看起來不對（應該是 re_ 開頭）。");
  process.exit(1);
}

const updates = {
  RESEND_API_KEY: apiKey,
  EMAIL_FROM: emailFrom ?? "假FB <onboarding@resend.dev>",
  APP_URL: appUrl ?? "http://localhost:3000",
};

let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

for (const [key, value] of Object.entries(updates)) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
}

writeFileSync(envPath, env.trimStart() + "\n", "utf8");

console.log("✅ 已把設定寫進 .env");
console.log(`   RESEND_API_KEY = ${apiKey.slice(0, 8)}…（已遮蔽）`);
console.log(`   EMAIL_FROM     = ${updates.EMAIL_FROM}`);
console.log(`   APP_URL        = ${updates.APP_URL}`);
console.log("\n接下來：重新啟動 dev server（npm run dev）就會真的寄信了。");
