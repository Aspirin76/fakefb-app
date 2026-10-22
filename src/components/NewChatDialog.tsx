"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Npc = { id: string; name: string; color: string; handle: string };

/** 新增對話：可以選 1 位（1 對 1）或多位（群組聊天） */
export function NewChatDialog({
  npcs,
  onClose,
}: {
  npcs: Npc[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function start() {
    if (picked.length === 0) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npcIds: picked }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "建立對話失敗");
        setBusy(false);
        return;
      }

      router.push(`/chat/${data.conversationId}`);
    } catch {
      setError("連線失敗，請稍後再試一次。");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">新增對話</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-[#606770] hover:bg-[#f0f2f5]"
          >
            關閉
          </button>
        </div>

        <p className="mt-1 text-sm text-[#606770]">
          選 1 位開 1 對 1 對話，選 2 位以上就是群組聊天（大家一起回你）。
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {npcs.map((npc) => {
            const on = picked.includes(npc.id);
            return (
              <button
                key={npc.id}
                type="button"
                onClick={() => toggle(npc.id)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  on
                    ? "border-[#1877f2] bg-[#e7f3ff]"
                    : "border-[#dddfe2] hover:bg-[#f0f2f5]"
                }`}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-white"
                  style={{ backgroundColor: npc.color }}
                >
                  {npc.name.slice(0, 1)}
                </span>
                <span>
                  <span className="block font-semibold">{npc.name}</span>
                  <span className="block text-xs text-[#606770]">
                    @{npc.handle}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={start}
          disabled={picked.length === 0 || busy}
          className="fb-btn mt-4 w-full"
        >
          {busy
            ? "建立中…"
            : picked.length > 1
              ? `建立 ${picked.length} 人群組`
              : "開始聊天"}
        </button>
      </div>
    </div>
  );
}
