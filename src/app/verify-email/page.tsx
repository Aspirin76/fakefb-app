import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmailToken } from "@/lib/verification";

export const metadata: Metadata = {
  title: "Email 驗證",
};

// 這個頁面需要在請求時讀取 cookie / 資料庫，允許阻塞渲染
export const instant = false;

const views = {
  ok: {
    icon: "✅",
    title: "驗證成功！",
    body: "你的 Email 已經驗證完成，現在可以登入FakeBook 了。",
    action: { href: "/login", label: "立即登入" },
  },
  "already-verified": {
    icon: "✅",
    title: "這個 Email 已經驗證過了",
    body: "不需要重複驗證，直接登入就可以了。",
    action: { href: "/login", label: "立即登入" },
  },
  expired: {
    icon: "⌛",
    title: "驗證信已經過期",
    body: "驗證連結有效期是 24 小時，請重新寄一封驗證信。",
    action: { href: "/resend-verification", label: "重新寄送驗證信" },
  },
  invalid: {
    icon: "❌",
    title: "驗證連結無效",
    body: "這個連結不正確或已被使用過，請重新寄一封驗證信。",
    action: { href: "/resend-verification", label: "重新寄送驗證信" },
  },
} as const;

export default async function VerifyEmailPage(props: PageProps<"/verify-email">) {
  const { token } = await props.searchParams;
  const rawToken = typeof token === "string" ? token : "";

  const result = rawToken
    ? await verifyEmailToken(rawToken)
    : ({ status: "invalid" } as const);

  const view = views[result.status];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
      <div className="rounded-xl bg-white p-8 text-center shadow-sm">
        <div className="text-5xl">{view.icon}</div>
        <h1 className="mt-5 text-2xl font-bold">{view.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#606770]">{view.body}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href={view.action.href} className="fb-btn w-full">
            {view.action.label}
          </Link>
          <Link href="/" className="fb-btn-secondary w-full">
            回到首頁
          </Link>
        </div>
      </div>
    </div>
  );
}
