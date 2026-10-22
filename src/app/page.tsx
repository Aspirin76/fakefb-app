import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

// 首頁會讀 cookie 判斷登入狀態，允許在請求時阻塞渲染
export const instant = false;

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-[#1877f2]">假FB</h1>
          <p className="mt-4 text-lg leading-relaxed text-[#606770]">
            一個仿造 Facebook 的社群網站練習專案。
            <br />
            目前已完成：註冊、Email 驗證信、登入 / 登出。
          </p>

          <ul className="mt-6 space-y-2 text-[#1c1e21]">
            {[
              "註冊帳號（密碼以 bcrypt 雜湊儲存）",
              "透過 Resend 寄送 Email 驗證信",
              "驗證信連結 24 小時有效、只能用一次",
              "登入 / 登出與 httpOnly session cookie",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1877f2]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Link href="/feed" className="fb-btn">
                前往動態牆
              </Link>
            ) : (
              <>
                <Link href="/register" className="fb-btn">
                  建立帳號
                </Link>
                <Link href="/login" className="fb-btn-secondary">
                  登入
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-[#1877f2]">假FB</h2>
          <p className="mt-2 text-sm text-[#606770]">
            把你的人生經驗分享給朋友們…
          </p>
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-[#dddfe2] p-3">
              <span className="h-10 w-10 rounded-full bg-[#e4e6eb]" />
              <span className="text-sm text-[#606770]">王小明 發文說…</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[#dddfe2] p-3">
              <span className="h-10 w-10 rounded-full bg-[#e4e6eb]" />
              <span className="text-sm text-[#606770]">李小華 分享了一則連結</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
