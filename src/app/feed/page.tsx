import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { StoriesBar } from "@/components/StoriesBar";
import { OnlineFriends } from "@/components/OnlineFriends";
import { FeedLiveUpdates } from "@/components/FeedLiveUpdates";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getStoryGroups } from "@/lib/stories";
import { userColor } from "@/lib/users";

export const metadata: Metadata = {
  title: "動態牆",
};

// 動態牆需要登入狀態，允許在請求時阻塞渲染
export const instant = false;

export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [posts, storyGroups, users] = await Promise.all([
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        author: { select: { id: true, name: true } },
        likes: { select: { userId: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    }),
    getStoryGroups(user.id),
    prisma.user.findMany({
      where: { isNpc: false },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const storyGroupsWithColor = storyGroups.map((group) => ({
    ...group,
    color: userColor(group.authorId),
    stories: group.stories.map((story) => ({
      ...story,
      createdAt: story.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 lg:grid-cols-3">
      <FeedLiveUpdates />
      <aside className="space-y-4 lg:col-span-1">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877f2] text-lg font-bold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.name}</p>
              <p className="truncate text-xs text-[#606770]">{user.email}</p>
            </div>
          </div>
          <p className="mt-3 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            ✓ Email 已驗證
          </p>
        </div>

        <OnlineFriends
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            color: userColor(u.id),
          }))}
          currentUserId={user.id}
        />
      </aside>

      <div className="space-y-4 lg:col-span-2">
        <StoriesBar groups={storyGroupsWithColor} currentUserId={user.id} />

        <PostComposer />

        {posts.length === 0 && (
          <div className="rounded-xl bg-white p-8 text-center text-sm text-[#606770] shadow-sm">
            還沒有任何貼文，來發你的第一篇吧！
          </div>
        )}

        {posts.map((post) => (
          <PostCard
            key={post.id}
            currentUserId={user.id}
            post={{
              id: post.id,
              content: post.content,
              createdAt: post.createdAt.toISOString(),
              author: {
                id: post.author.id,
                name: post.author.name,
                color: userColor(post.author.id),
              },
              liked: post.likes.some((like) => like.userId === user.id),
              likeCount: post.likes.length,
              comments: post.comments.map((comment) => ({
                id: comment.id,
                content: comment.content,
                createdAt: comment.createdAt.toISOString(),
                author: {
                  id: comment.user.id,
                  name: comment.user.name,
                  color: userColor(comment.user.id),
                },
              })),
            }}
          />
        ))}
      </div>
    </div>
  );
}
