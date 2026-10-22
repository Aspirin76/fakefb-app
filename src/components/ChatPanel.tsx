"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

export function ChatPanel({
  conversationId,
  npc,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  npc: { id: string; name: string; color: string };
  currentUserId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  async function send() {
    const content = input.trim();
    if (!content || pending) return;

    setInput("");
    setError(null);
    setPending(true);

    // 先把使用者訊息optimistic 顯示出來
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      senderId: currentUserId,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(content);
        setError(data?.error ?? "傳送失敗，請稍後再試一次。");
        return;
      }

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        data.userMessage,
        data.npcMessage,
      ]);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(content);
      setError("連線失敗，請確認 OpenCode 服務有在執行。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-16 text-center text-sm text-[#606770]">
            <p className="text-4xl">👋</p>
            <p className="mt-3">
              跟 {npc.name} 說點什麼吧！
            </p>
          </div>
        )}

        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          return (
            <div
              key={message.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  mine
                    ? "rounded-br-sm bg-[#1877f2] text-white"
                    : "rounded-bl-sm bg-[#e4e6eb] text-[#1c1e21]"
                }`}
              >
                {message.content}
              </div>
            </div>
          );
        })}

        {pending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-[#e4e6eb] px-4 py-3">
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

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        className="flex items-center gap-2 border-t border-[#dddfe2] bg-white p-3"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={`傳訊息給 ${npc.name}…`}
          className="fb-input"
          maxLength={1000}
          disabled={pending}
        />
        <button type="submit" disabled={pending || !input.trim()} className="fb-btn">
          送出
        </button>
      </form>
    </div>
  );
}
