"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  senderId: string;
  type: string;
  content: string;
  replyToId: string | null;
  reactions: Record<string, string>;
  readAt: string | null;
  deletedAt: string | null;
  createdAt: string;
};

export type Participant = {
  id: string;
  name: string;
  color: string;
};

const STICKERS = [
  "👍", "😂", "🥰", "😮", "😢", "🎉", "🔥", "❤️",
  "🙌", "💯", "😅", "🤔", "😴", "🤯", "👏", "✨",
];

const QUICK_REPLIES = ["早安 ☀️", "你在幹嘛？", "哈哈哈", "+1", "晚安 😴"];

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

function hhmm(iso: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return "今天";

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "昨天";

  return new Intl.DateTimeFormat("zh-TW", {
    month: "long",
    day: "numeric",
  }).format(date);
}

export function ChatPanel({
  conversationId,
  currentUser,
  participants,
  initialMessages,
}: {
  conversationId: string;
  currentUser: { id: string; name: string };
  participants: Participant[];
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [menuTarget, setMenuTarget] = useState<string | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tmpCounter = useRef(0);

  const isGroup = participants.length > 1;

  const participantOf = useCallback(
    (id: string) => participants.find((p) => p.id === id),
    [participants],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  // 進入對話就把對方息標成已讀
  useEffect(() => {
    void fetch(`/api/chat/${conversationId}/read`, { method: "POST" });
  }, [conversationId]);

  const lastMine = useMemo(() => {
    const mine = messages.filter((m) => m.senderId === currentUser.id);
    return mine.at(-1);
  }, [messages, currentUser.id]);

  async function send(payload: {
    content: string;
    type?: "text" | "sticker";
    replyToId?: string | null;
  }) {
    if (pending || !payload.content.trim()) return;

    setInput("");
    setError(null);
    setPending(true);
    setReplyTo(null);
    setStickerOpen(false);

    tmpCounter.current += 1;
    const optimistic: ChatMessage = {
      id: `tmp-${tmpCounter.current}`,
      senderId: currentUser.id,
      type: payload.type ?? "text",
      content: payload.content,
      replyToId: payload.replyToId ?? null,
      reactions: {},
      readAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(payload.content);
        setError(data?.error ?? "傳送失敗，請稍後再試一次。");
        return;
      }

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        data.userMessage,
        ...data.npcMessages,
      ]);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(payload.content);
      setError("連線失敗，請確認 OpenCode 服務有在執行。");
    } finally {
      setPending(false);
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    setMenuTarget(null);

    // 先樂觀更新
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...m.reactions };
        if (reactions[currentUser.id] === emoji) {
          delete reactions[currentUser.id];
        } else {
          reactions[currentUser.id] = emoji;
        }
        return { ...m, reactions };
      }),
    );

    await fetch(
      `/api/chat/${conversationId}/messages/${messageId}/react`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      },
    ).catch(() => {});
  }

  async function deleteMessage(messageId: string) {
    setMenuTarget(null);
    await fetch(`/api/chat/${conversationId}/messages/${messageId}`, {
      method: "DELETE",
    }).catch(() => {});

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, deletedAt: new Date().toISOString(), content: "" }
          : m,
      ),
    );
  }

  async function copyMessage(message: ChatMessage) {
    setMenuTarget(null);
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      /* 忽略 */
    }
  }

  function startReply(message: ChatMessage) {
    setMenuTarget(null);
    setReplyTo(message);
    inputRef.current?.focus();
  }

  // 訊息依照日期分組，中間插日期分隔線
  const rows = useMemo(() => {
    const result: Array<
      | { kind: "day"; label: string }
      | { kind: "msg"; message: ChatMessage; showName: boolean }
    > = [];

    let lastDay = "";
    let lastSender = "";

    for (const message of messages) {
      const day = dayLabel(message.createdAt);
      if (day !== lastDay) {
        result.push({ kind: "day", label: day });
        lastDay = day;
        lastSender = "";
      }

      result.push({
        kind: "msg",
        message,
        showName:
          isGroup &&
          message.senderId !== currentUser.id &&
          message.senderId !== lastSender,
      });

      lastSender = message.senderId;
    }

    return result;
  }, [messages, isGroup, currentUser.id]);

  const replyTarget = replyTo
    ? messages.find((m) => m.id === replyTo.id)
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* 訊息列表 */}
      <div className="chatbody flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-16 text-center text-sm text-[#606770]">
            <p className="text-4xl">👋</p>
            <p className="mt-3">開始你們的對話吧！</p>
          </div>
        )}

        {rows.map((row, index) => {
          if (row.kind === "day") {
            return (
              <div
                key={`day-${index}`}
                className="mx-auto w-fit rounded-full bg-[#e4e6eb] px-3 py-1 text-[11px] text-[#606770]"
              >
                {row.label}
              </div>
            );
          }

          const message = row.message;
          const mine = message.senderId === currentUser.id;
          const deleted = Boolean(message.deletedAt);
          const sender = participantOf(message.senderId);
          const quoted = message.replyToId
            ? messages.find((m) => m.id === message.replyToId)
            : null;

          const reactionEntries = Object.entries(message.reactions);
          const reactionCounts = new Map<string, number>();
          for (const [, emoji] of reactionEntries) {
            reactionCounts.set(emoji, (reactionCounts.get(emoji) ?? 0) + 1);
          }

          return (
            <div
              key={message.id}
              className={`msgrow flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}
            >
              {!mine && (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: sender?.color ?? "#8a8d91" }}
                >
                  {sender?.name.slice(0, 1) ?? "?"}
                </span>
              )}

              <div
                className={`col flex max-w-[78%] flex-col gap-1 ${
                  mine ? "items-end" : "items-start"
                }`}
              >
                {row.showName && !deleted && (
                  <span className="ml-3 text-[11px] text-[#606770]">
                    {sender?.name}
                  </span>
                )}

                <div className="relative">
                  {/* 點訊息開選單 */}
                  <button
                    type="button"
                    onClick={() =>
                      setMenuTarget(menuTarget === message.id ? null : message.id)
                    }
                    className={`bubble block w-full cursor-pointer rounded-2xl px-4 py-2.5 text-left text-[14.5px] leading-relaxed whitespace-pre-wrap break-words ${
                      mine
                        ? "bg-[#1877f2] text-white"
                        : "bg-white text-[#1c1e21] shadow-sm"
                    } ${
                      deleted
                        ? "bg-[#e4e6eb]! text-[#8a8d91]! italic"
                        : ""
                    } ${
                      message.type === "sticker"
                        ? "bg-transparent! p-0! text-5xl shadow-none!"
                        : ""
                    }`}
                  >
                    {quoted && !deleted && (
                      <span
                        className={`mb-1.5 block rounded-lg border-l-2 px-2 py-1 text-xs ${
                          mine
                            ? "border-white/70 bg-white/15"
                            : "border-[#1877f2] bg-[#f0f2f5]"
                        }`}
                      >
                        <span className="block font-semibold">
                          {quoted.senderId === currentUser.id
                            ? "你"
                            : (participantOf(quoted.senderId)?.name ?? "訊息")}
                        </span>
                        <span className="block truncate opacity-80">
                          {quoted.deletedAt ? "訊息已刪除" : quoted.content}
                        </span>
                      </span>
                    )}

                    {deleted
                      ? "這則訊息已刪除"
                      : message.type === "sticker"
                        ? message.content
                        : message.content}
                  </button>

                  {/* 訊息選單 */}
                  {menuTarget === message.id && !deleted && (
                    <div className="absolute bottom-full z-20 mb-2 rounded-xl bg-white p-2 shadow-xl">
                      <div className="flex gap-1">
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(message.id, emoji)}
                            className="rounded-lg px-2 py-1 text-xl transition hover:bg-[#f0f2f5]"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1 flex flex-col border-t border-[#dddfe2] pt-1">
                        <button
                          type="button"
                          onClick={() => startReply(message)}
                          className="rounded-lg px-3 py-1.5 text-left text-sm hover:bg-[#f0f2f5]"
                        >
                          回覆
                        </button>
                        <button
                          type="button"
                          onClick={() => copyMessage(message)}
                          className="rounded-lg px-3 py-1.5 text-left text-sm hover:bg-[#f0f2f5]"
                        >
                          複製
                        </button>
                        {mine && (
                          <button
                            type="button"
                            onClick={() => deleteMessage(message.id)}
                            className="rounded-lg px-3 py-1.5 text-left text-sm text-red-600 hover:bg-[#f0f2f5]"
                          >
                            刪除
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 表情回應 */}
                {reactionCounts.size > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {[...reactionCounts.entries()].map(([emoji, count]) => {
                      const mineReacted =
                        message.reactions[currentUser.id] === emoji;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleReaction(message.id, emoji)}
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            mineReacted
                              ? "border-[#1877f2] bg-[#e7f3ff]"
                              : "border-[#dddfe2] bg-white"
                          }`}
                        >
                          {emoji}
                          {count > 1 && <b className="ml-0.5">{count}</b>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 時間 + 已讀狀態 */}
                <span className="text-[10.5px] text-[#8a8d91]">
                  {hhmm(message.createdAt)}
                  {mine && message.id === lastMine?.id && !deleted && (
                    <>
                      {" · "}
                      {message.readAt ? "已讀" : "已送出"}
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        })}

        {/* 對方正在輸入 */}
        {pending && (
          <div className="flex items-end gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8a8d91] text-xs font-bold text-white">
              {participants[0]?.name.slice(0, 1) ?? "?"}
            </span>
            <div className="flex items-center gap-1 rounded-2xl bg-white px-4 py-3 shadow-sm">
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#8a8d91]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#8a8d91] [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#8a8d91] [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mx-4 mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* 回覆列 */}
      {replyTarget && (
        <div className="flex items-center gap-2 border-t border-[#dddfe2] bg-[#f0f2f5] px-3 py-2">
          <div className="min-w-0 flex-1 border-l-2 border-[#1877f2] pl-2">
            <p className="text-xs font-semibold">
              回覆{" "}
              {replyTarget.senderId === currentUser.id
                ? "你自己"
                : (participantOf(replyTarget.senderId)?.name ?? "")}
            </p>
            <p className="truncate text-xs text-[#606770]">
              {replyTarget.content}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="rounded-md px-2 py-1 text-sm text-[#606770] hover:bg-[#e4e6eb]"
          >
            取消
          </button>
        </div>
      )}

      {/* 貼圖列 */}
      {stickerOpen && (
        <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto border-t border-[#dddfe2] bg-[#f0f2f5] p-3">
          {STICKERS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => void send({ content: emoji, type: "sticker" })}
              className="rounded-lg bg-white py-1 text-2xl transition hover:scale-110 hover:bg-[#e7f3ff]"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* 快速回覆 */}
      <div className="flex gap-1.5 overflow-x-auto border-t border-[#dddfe2] bg-[#f0f2f5] px-3 py-2">
        {QUICK_REPLIES.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => void send({ content: text })}
            disabled={pending}
            className="shrink-0 rounded-full border border-[#dddfe2] bg-white px-3 py-1 text-xs hover:border-[#1877f2] hover:text-[#1877f2] disabled:opacity-50"
          >
            {text}
          </button>
        ))}
      </div>

      {/* 輸入列 */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send({
            content: input,
            replyToId: replyTo?.id ?? null,
          });
        }}
        className="flex items-end gap-2 border-t border-[#dddfe2] bg-white p-3"
      >
        <button
          type="button"
          onClick={() => setStickerOpen((v) => !v)}
          className="rounded-full px-2 py-1 text-xl hover:bg-[#f0f2f5]"
          title="貼圖"
        >
          😊
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send({
                content: input,
                replyToId: replyTo?.id ?? null,
              });
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="傳送訊息…"
          className="fb-input max-h-32 flex-1 resize-none py-2.5"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="fb-btn px-4 py-2.5"
        >
          送出
        </button>
      </form>
    </div>
  );
}
