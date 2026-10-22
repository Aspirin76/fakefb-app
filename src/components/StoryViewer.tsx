"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Story = {
  id: string;
  content: string;
  emoji: string | null;
  color: string | null;
  createdAt: string;
  viewed: boolean;
};

type Group = {
  authorId: string;
  authorName: string;
  color: string;
  stories: Story[];
};

const STORY_SECONDS = 5;

/**
 * 限時動態的觀看器
 *
 * - 全螢幕顯示，可以左右切換作者的動態
 * - 上方有進度條，5 秒自動跳下一則
 * - 點左右兩側切換，中間的愛心可以按讚
 */
export function StoryViewer({
  groups,
  startAuthorId,
  currentUserId,
  onClose,
}: {
  groups: Group[];
  startAuthorId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [groupIndex, setGroupIndex] = useState(() =>
    Math.max(
      0,
      groups.findIndex((g) => g.authorId === startAuthorId),
    ),
  );
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(false);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  // 自動前進
  useEffect(() => {
    if (!story) return;

    const started = Date.now();
    let first = true;

    const timer = setInterval(() => {
      // 第一個 tick 才重設進度，避免在 effect 裡直接 setState
      if (first) {
        first = false;
        setProgress(0);
      }

      const ratio = (Date.now() - started) / (STORY_SECONDS * 1000);
      setProgress(Math.min(1, ratio));

      if (ratio >= 1) {
        next();
      }
    }, 50);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  // 標記看過
  useEffect(() => {
    if (!story || story.viewed) return;
    void fetch(`/api/stories/${story.id}/view`, { method: "POST" }).then(() => {
      router.refresh();
    });
  }, [story, router]);

  function next() {
    if (!group) return;

    if (storyIndex < group.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
      return;
    }

    if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
      return;
    }

    onClose();
  }

  function prev() {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      return;
    }

    if (groupIndex > 0) {
      const previous = groups[groupIndex - 1];
      setGroupIndex(groupIndex - 1);
      setStoryIndex(Math.max(0, previous.stories.length - 1));
      return;
    }

    onClose();
  }

  if (!group || !story) return null;

  const background = story.color ?? "#1877f2";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="relative flex h-full w-full max-w-md flex-col">
        {/* 上方進度條 */}
        <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-3">
          {group.stories.map((item, index) => (
            <span key={item.id} className="h-0.5 flex-1 overflow-hidden rounded bg-white/30">
              <span
                className="block h-full bg-white transition-[width] duration-100"
                style={{
                  width:
                    index < storyIndex
                      ? "100%"
                      : index === storyIndex
                        ? `${progress * 100}%`
                        : "0%",
                }}
              />
            </span>
          ))}
        </div>

        {/* 作者 */}
        <div className="absolute inset-x-0 top-8 z-10 flex items-center gap-3 px-4">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: group.color }}
          >
            {group.authorName.slice(0, 1)}
          </span>
          <span className="font-semibold text-white">{group.authorName}</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-full bg-white/20 px-3 py-1 text-sm text-white"
          >
            關閉
          </button>
        </div>

        {/* 內容 */}
        <div
          className="flex flex-1 flex-col items-center justify-center gap-6 p-8"
          style={{ background }}
        >
          {story.emoji && <div className="text-7xl">{story.emoji}</div>}
          <p className="text-center text-xl leading-relaxed font-medium text-white">
            {story.content}
          </p>
        </div>

        {/* 愛心 */}
        <button
          type="button"
          onClick={() => setLiked((v) => !v)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-4xl transition hover:scale-110"
          aria-label="按讚"
        >
          {liked ? "❤️" : "🤍"}
        </button>

        {/* 左右切換 */}
        <button
          type="button"
          onClick={prev}
          className="absolute inset-y-0 left-0 w-1/3 cursor-pointer"
          aria-label="上一個"
        />
        <button
          type="button"
          onClick={next}
          className="absolute inset-y-0 right-0 w-1/3 cursor-pointer"
          aria-label="下一個"
        />

        {currentUserId === group.authorId && (
          <span className="absolute bottom-6 right-4 text-xs text-white/70">
            這是你的限時動態
          </span>
        )}
      </div>
    </div>
  );
}
