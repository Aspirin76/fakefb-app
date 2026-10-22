import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PostComposer } from "@/components/PostComposer";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "動態牆",
};

// 這個頁面需要在請求時讀取 cookie / 資料庫，允許阻塞渲染
export const instant = false;

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { author: { select: { id: true, name: true } } },
  });

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 lg:grid-cols-3">
      <aside className="space-y-4 lg:col-span-1">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877f2] text-lg font-bold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-xs text-[#606770]">{user.email}</p>
            </div>
          </div>
          <p className="mt-3 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            ✓ Email 已驗證
          </p>
        </div>
      </aside>

      <div className="space-y-4 lg:col-span-2">
        <PostComposer />

        {posts.length === 0 && (
          <div className="rounded-xl bg-white p-8 text-center text-sm text-[#606770] shadow-sm">
            還沒有任何貼文，來發你的第一篇吧！
          </div>
        )}

        {posts.map((post) => (
          <article key={post.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e4e6eb] font-bold text-[#606770]">
                {post.author.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="font-semibold">{post.author.name}</p>
                <p className="text-xs text-[#8a8d91]">{formatTime(post.createdAt)}</p>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed">{post.content}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
