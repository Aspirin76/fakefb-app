"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StoryViewer } from "@/components/StoryViewer";

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

const EMOJIS = ["🌄", "☕", "🍜", "🐱", "🎂", "🌊", "🎉", "🌙", "🚲", "🏔️"];

/** 限時動態列 + 發布動態 + 觀看器 */
export function StoriesBar({
  groups,
  currentUserId,
}: {
  groups: Group[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [openAuthorId, setOpenAuthorId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createStory() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, emoji }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "發布失敗");
        setBusy(false);
        return;
      }

      setText("");
      setCreating(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError("連線失敗");
      setBusy(false);
    }
  }

  const myGroup = groups.find((g) => g.authorId === currentUserId);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto rounded-xl bg-white p-3 shadow-sm">
        {/* 自己的：新增限時動態 */}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex w-16 shrink-0 flex-col items-center gap-1"
        >
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-[#1877f2] bg-[#e7f3ff] text-xl">
            ＋
            {myGroup && (
              <span className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#1877f2] text-[10px] text-white">
                {myGroup.stories.length}
              </span>
            )}
          </span>
          <span className="max-w-full truncate text-xs text-[#606770]">
            發布動態
          </span>
        </button>

        {groups.map((group) => {
          const first = group.stories[0];
          const allSeen = group.stories.every((s) => s.viewed);

          return (
            <button
              key={group.authorId}
              type="button"
              onClick={() => setOpenAuthorId(group.authorId)}
              className="flex w-16 shrink-0 flex-col items-center gap-1"
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-full p-0.5 ${
                  allSeen
                    ? "bg-[#dddfe2]"
                    : "bg-gradient-to-tr from-[#f58518] via-[#dd2a7b] to-[#8b5cf6]"
                }`}
              >
                <span
                  className="flex h-full w-full items-center justify-center rounded-full border-2 border-white text-2xl"
                  style={{ backgroundColor: group.color }}
                >
                  {first.emoji ?? group.authorName.slice(0, 1)}
                </span>
              </span>
              <span className="max-w-full truncate text-xs text-[#606770]">
                {group.authorName}
              </span>
            </button>
          );
        })}
      </div>

      {/* 發布動態 */}
      {creating && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setCreating(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">發布限時動態</h2>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-md px-2 py-1 text-sm text-[#606770] hover:bg-[#f0f2f5]"
              >
                關閉
              </button>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto">
              {EMOJIS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEmoji(item)}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${
                    emoji === item ? "bg-[#e7f3ff]" : "bg-[#f0f2f5]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={120}
              rows={2}
              placeholder="現在在做什麼？"
              className="fb-input mt-3 resize-none"
            />

            {error && (
              <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <p className="mt-2 text-xs text-[#8a8d91]">
              限時動態會在 24 小時後消失。
            </p>

            <button
              type="button"
              onClick={createStory}
              disabled={!text.trim() || busy}
              className="fb-btn mt-3 w-full"
            >
              {busy ? "發布中…" : "發布"}
            </button>
          </div>
        </div>
      )}

      {/* 觀看器 */}
      {openAuthorId && (
        <StoryViewer
          groups={groups}
          startAuthorId={openAuthorId}
          currentUserId={currentUserId}
          onClose={() => {
            setOpenAuthorId(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
