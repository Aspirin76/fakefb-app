import { Resend } from "resend";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

/** 讀取寄件人設定，沒設定就給一個好讀的錯誤訊息 */
function getFrom() {
  return process.env.EMAIL_FROM?.trim() || "FakeBook <onboarding@resend.dev>";
}

/** 檢查 Resend 是否已經設定好 */
export function isEmailConfigured() {
  const key = process.env.RESEND_API_KEY?.trim();
  return Boolean(key && !key.startsWith("re_xxxx"));
}

let resendClient: Resend | null = null;
function getResend() {
  if (!isEmailConfigured()) {
    throw new Error(
      "尚未設定 RESEND_API_KEY。請在 .env 填入 https://resend.com/api-keys 取得的金鑰。",
    );
  }
  resendClient ??= new Resend(process.env.RESEND_API_KEY!);
  return resendClient;
}

function appUrl() {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * 把寄出的信記錄到 dev-mails.log（只在開發環境）。
 * 就像 Django 的 console email backend 一樣，
 * 方便沒有真的收到信、或要自動化測試的時候查看驗證連結。
 */
export const DEV_MAILBOX_LOG = "dev-mails.log";

function logToDevMailbox(to: string, subject: string, verifyUrl: string) {
  if (process.env.NODE_ENV === "production") return;

  const entry = [
    "",
    "=".repeat(60),
    `時間: ${new Date().toLocaleString("zh-TW")}`,
    `收件人: ${to}`,
    `主旨: ${subject}`,
    `驗證連結: ${verifyUrl}`,
    "",
  ].join("\n");

  try {
    appendFileSync(join(process.cwd(), DEV_MAILBOX_LOG), entry, "utf8");
  } catch (error) {
    console.warn("[email] 無法寫入開發信箱記錄檔:", error);
  }
}

/** 驗證信用的 HTML 樣板 */
function verificationEmailHtml(name: string, verifyUrl: string) {
  return `
<!doctype html>
<html lang="zh-Hant">
  <body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;color:#1c1e21;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08);">
            <tr>
              <td style="background:#1877f2;padding:24px 32px;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">FakeBook</h1>
                <p style="margin:4px 0 0;color:#dbe9ff;font-size:14px;">歡迎加入FakeBook</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi，${escapeHtml(name)}！</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3a3b3c;">
                  請點擊下面的按鈕完成 Email 驗證，驗證後就可以開始使用FakeBook 了。
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${verifyUrl}"
                     style="display:inline-block;background:#1877f2;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 28px;border-radius:8px;">
                    驗證我的 Email
                  </a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#8a8d91;">
                  按鈕沒反應？請把下面的網址複製到瀏覽器開啟：
                </p>
                <p style="margin:0 0 24px;font-size:13px;word-break:break-all;color:#1877f2;">
                  ${verifyUrl}
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#8a8d91;">
                  這封驗證信將於 <strong>24 小時</strong>後失效。若你沒有申請FakeBook帳號，請忽略此信。
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f0f2f5;padding:16px 32px;">
                <p style="margin:0;font-size:12px;color:#8a8d91;">© FakeBook · 這是系統寄出的驗證信</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 寄出 Email 驗證信。
 * Resend 的 Node SDK 不會丟例外，而是回傳 { data, error }，所以要自己檢查 error。
 *
 * 開發模式（沒有設定 RESEND_API_KEY 且不是 production）不會真的寄信，
 * 而是把驗證連結印到終端機並回傳，方便先把流程跑起來。
 */
export async function sendVerificationEmail({
  to,
  name,
  token,
  idempotencyKey,
}: {
  to: string;
  name: string;
  token: string;
  idempotencyKey: string;
}) {
  const verifyUrl = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "【FakeBook】請驗證你的 Email 帳號";

  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "尚未設定 RESEND_API_KEY。請在 .env 填入 https://resend.com/api-keys 取得的金鑰。",
      );
    }

    console.warn(
      `\n[email] 開發模式：沒有設定 RESEND_API_KEY，所以沒有實際寄信。\n` +
        `        收件人：${to}\n` +
        `        驗證連結：${verifyUrl}\n`,
    );

    logToDevMailbox(to, subject, verifyUrl);

    return { id: "dev-mode-no-send", verifyUrl, devMode: true as const };
  }

  const resend = getResend();

  const { data, error } = await resend.emails.send(
    {
      from: getFrom(),
      to: [to],
      subject,
      html: verificationEmailHtml(name, verifyUrl),
      text: `Hi ${name}！請開啟以下連結完成 Email 驗證：${verifyUrl}（24 小時內有效）`,
    },
    { idempotencyKey },
  );

  if (error) {
    throw new Error(`寄送驗證信失敗：${error.message}`);
  }

  logToDevMailbox(to, subject, verifyUrl);

  return { id: data?.id, verifyUrl, devMode: false as const };
}
