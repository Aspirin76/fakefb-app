"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions/auth";

type Me = {
  id: string;
  name: string;
  email: string;
} | null;

/**
 * navbar 右邊的登入狀態。
 *
 * 這裡刻意不在 root layout 用 cookies() 讀登入狀態：
 * Server Action 回傳錯誤訊息時，layout 會被重新渲染，
 * 而在 layout 呼叫 cookies() 會觸發 Next.js 的 invariant 錯誤、讓整個 layout 壞掉。
 * 改成由 client 端打 /api/auth/me 取得，兩邊都不會踩到這個問題。
 */
export function UserMenu() {
  const pathname = usePathname();
  const [user, setUser] = useState<Me | undefined>(undefined);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user: Me }) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  if (user === undefined) {
    return <div className="h-8 w-24 animate-pulse rounded-md bg-white/20" />;
  }

  if (!user) {
    return (
      <>
        <Link
          href="/login"
          className="rounded-md bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
        >
          登入
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-[#1877f2] hover:bg-gray-100"
        >
          註冊
        </Link>
      </>
    );
  }

  return (
    <>
      <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-white/25 text-sm font-bold text-white sm:flex">
        {user.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="hidden text-sm font-semibold text-white sm:block">
        {user.name}
      </span>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-md bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
        >
          登出
        </button>
      </form>
    </>
  );
}
