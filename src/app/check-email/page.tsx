import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "請查收驗證信",
};

// 這個頁面需要在請求時讀取 cookie / 資料庫，允許阻塞渲染
export const instant = false;

export default async function CheckEmailPage(props: PageProps<"/check-email">) {
  const { email, dev } = await props.searchParams;
  const address = typeof email === "string" ? email : "";
  const devLink = typeof dev === "string" ? dev : "";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
      <div className="rounded-xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f3ff] text-3xl">
          ✉️
        </div>
        <h1 className="mt-5 text-2xl font-bold">請查收你的信箱</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#606770]">
          我們已經把 Email 驗證信寄到
          {address ? (
            <span className="font-semibold text-[#1c1e21]"> {address} </span>
          ) : (
            "你的信箱"
          )}
          ，請點信中的連結完成驗證。
        </p>
        <p className="mt-2 text-xs text-[#8a8d91]">
          沒收到？請確認垃圾邮件匣，或稍等幾分鐘後再重新寄送。
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link href="/resend-verification" className="fb-btn w-full">
            重新寄送驗證信
          </Link>
          <Link href="/login" className="fb-btn-secondary w-full">
            我已經驗證了，去登入
          </Link>
        </div>

        {devLink && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-left">
            <p className="text-sm font-semibold text-amber-800">
              ⚠️ 開發模式（尚未設定 RESEND_API_KEY）
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              這封信沒有真的寄出去。在 .env 設定 RESEND_API_KEY 之後就會正常寄信。
              現在可以直接用下面的連結完成驗證：
            </p>
            <a
              href={devLink}
              className="mt-2 block break-all text-xs font-semibold text-[#1877f2] underline"
            >
              {devLink}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
