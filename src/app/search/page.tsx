import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "搜尋",
};

// 這個頁面需要在請求時讀取 cookie / 資料庫，允許阻塞渲染
export const instant = false;

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const keyword = typeof q === "string" ? q.trim() : "";

  const users = keyword
    ? await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: keyword } },
            { email: { contains: keyword } },
          ],
        },
        select: { id: true, name: true, email: true },
        take: 20,
      })
    : [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold">搜尋結果</h1>

      {keyword ? (
        <p className="mt-1 text-sm text-[#606770]">
          關鍵字「{keyword}」找到 {users.length} 個結果
        </p>
      ) : (
        <p className="mt-1 text-sm text-[#606770]">請在上面的搜尋欄輸入關鍵字。</p>
      )}

      <div className="mt-4 space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e4e6eb] font-bold text-[#606770]">
              {u.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="font-semibold">{u.name}</p>
              <p className="text-xs text-[#606770]">{u.email}</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/feed"
        className="mt-6 inline-block text-sm font-semibold text-[#1877f2] hover:underline"
      >
        ← 回到動態牆
      </Link>
    </div>
  );
}
