"use client";

import { useState } from "react";
import { useRealtime } from "@/components/RealtimeProvider";

export type PostComment = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; color: string };
};

export type PostData = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; color: string };
  liked: boolean;
  likeCount: number;
  comments: PostComment[];
};

/** 在線小綠點 */
export function OnlineDot({ userId }: { userId: string }) {
  const { online } = useRealtime();
  if (!online.includes(userId)) return null;

  return (
    <span
      className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#42b72a]"
      title="上線中"
    />
  );
}

/** 頭像 */
export function Avatar({
  name,
  color,
  userId,
  size = "md",
}: {
  name: string;
  color: string;
  userId: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "h-12 w-12 text-lg" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";

  return (
    <span className="relative shrink-0">
      <span
        className={`flex ${sizeClass} items-center justify-center rounded-full font-bold text-white`}
        style={{ backgroundColor: color }}
      >
        {name.trim().slice(0, 1).toUpperCase() || "?"}
      </span>
      <OnlineDot userId={userId} />
    </span>
  );
}

/** 貼文卡片：按讚 + 留言 */
export function PostCard({
  post,
  currentUserId,
}: {
  post: PostData;
  currentUserId: string;
}) {
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [comments, setComments] = useState(post.comments);
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggleLike() {
    // 先樂觀更新
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((count) => count + (nextLiked ? 1 : -1));

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setLiked(data.liked);
        setLikeCount(data.likeCount);
      }
    } catch {
      setLiked(!nextLiked);
      setLikeCount((count) => count + (nextLiked ? -1 : 1));
    }
  }

  async function addComment() {
    const content = draft.trim();
    if (!content || busy) return;

    setBusy(true);
    setDraft("");

    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();

      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
      } else {
        setDraft(content);
      }
    } catch {
      setDraft(content);
    } finally {
      setBusy(false);
    }
  }

  const visibleComments = showAll ? comments : comments.slice(-2);

  return (
    <article className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar
          name={post.author.name}
          color={post.author.color}
          userId={post.author.id}
        />
        <div className="min-w-0">
          <p className="font-semibold">{post.author.name}</p>
          <p className="text-xs text-[#8a8d91]">
            {new Intl.DateTimeFormat("zh-TW", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(post.createdAt))}
          </p>
        </div>
      </div>

      <p className="mt-3 leading-relaxed whitespace-pre-wrap">{post.content}</p>

      {/* 動作列 */}
      <div className="mt-3 flex items-center gap-4 border-t border-[#eee] pt-3 text-sm">
        <button
          type="button"
          onClick={toggleLike}
          className={`flex items-center gap-1.5 font-semibold transition ${
            liked ? "text-[#e41e3f]" : "text-[#606770] hover:text-[#e41e3f]"
          }`}
        >
          <span className="text-lg leading-none">{liked ? "❤️" : "🤍"}</span>
          {likeCount > 0 && <span>{likeCount}</span>}
          <span className="sr-only">按讚</span>
        </button>

        <span className="flex items-center gap-1.5 text-[#606770]">
          <span className="text-lg leading-none">💬</span>
          {comments.length > 0 && <span>{comments.length}</span>}
        </span>
      </div>

      {/* 留言列表 */}
      {comments.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-[#eee] pt-3">
          {comments.length > 2 && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-sm font-semibold text-[#606770] hover:underline"
            >
              查看全部 {comments.length} 則留言
            </button>
          )}

          {visibleComments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <Avatar
                name={comment.author.name}
                color={comment.author.color}
                userId={comment.author.id}
                size="sm"
              />
              <div className="min-w-0 flex-1 rounded-2xl bg-[#f0f2f5] px-3 py-2">
                <p className="text-sm font-semibold">{comment.author.name}</p>
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))}

          {showAll && comments.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="text-sm font-semibold text-[#606770] hover:underline"
            >
              收合留言
            </button>
          )}
        </div>
      )}

      {/* 留言輸入 */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void addComment();
        }}
        className="mt-3 flex items-center gap-2 border-t border-[#eee] pt-3"
      >
        <Avatar
          name="我"
          color="#1877f2"
          userId={currentUserId}
          size="sm"
        />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="寫點什麼…"
          maxLength={300}
          className="fb-input flex-1 !py-2 !text-sm"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
          className="fb-btn !px-3 !py-2 !text-sm"
        >
          留言
        </button>
      </form>
    </article>
  );
}
