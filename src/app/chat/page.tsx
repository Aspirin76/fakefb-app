import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewChatButton } from "@/components/NewChatButton";
import { getConversationsForUser, ensureConversation } from "@/lib/chat";
import { getCurrentUser } from "@/lib/session";
import { getNpcUsers } from "@/lib/npcs";

export const metadata: Metadata = {
  title: "聊天",
};

// 聊天頁需要登入狀態，允許在請求時阻塞渲染
export const instant = false;

function formatTime(date: Date) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  return new Intl.DateTimeFormat(
    "zh-TW",
    isToday
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : { month: "numeric", day: "numeric" },
  ).format(date);
}

function preview(content: string, type: string) {
  if (type === "sticker") return `${content} 貼圖`;
  return content;
}

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [npcs] = await Promise.all([getNpcUsers()]);

  // 每個 NPC 都先開好一段 1 對 1 對話，讓清單不會是空的
  await Promise.all(
    npcs.map((npc) => ensureConversation({ userId: user.id, npcIds: [npc.id] })),
  );

  const conversations = await getConversationsForUser(user.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">聊天</h1>
          <p className="mt-1 text-sm text-[#606770]">
            跟 FakeBook 的 NPC 好友聊天，回覆由 OpenCode（AI）即時生成。
          </p>
        </div>
        <NewChatButton
          npcs={npcs.map((npc) => ({
            id: npc.id,
            name: npc.name,
            color: npc.color,
            handle: npc.handle,
          }))}
        />
      </div>

      <div className="mt-5 space-y-2">
        {conversations.length === 0 && (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-[#606770] shadow-sm">
            還沒有對話，按右上角「新增對話」開始吧！
          </div>
        )}

        {conversations.map((conversation) => (
          <Link
            key={conversation.id}
            href={`/chat/${conversation.id}`}
            className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition hover:shadow"
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: conversation.color }}
            >
              {conversation.type === "group"
                ? "👥"
                : conversation.name.slice(0, 1)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {conversation.name}
                {conversation.type === "group" && (
                  <span className="ml-1 text-xs font-normal text-[#606770]">
                    · {conversation.members.length + 1} 人
                  </span>
                )}
              </p>
              <p
                className={`truncate text-sm ${
                  conversation.unread > 0
                    ? "font-semibold text-[#1c1e21]"
                    : "text-[#606770]"
                }`}
              >
                {conversation.lastMessage
                  ? `${
                      conversation.lastMessage.mine ? "你：" : ""
                    }${preview(
                      conversation.lastMessage.content,
                      conversation.lastMessage.type,
                    )}`
                  : "開始聊天"}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {conversation.lastMessage && (
                <span className="text-xs text-[#8a8d91]">
                  {formatTime(conversation.lastMessage.createdAt)}
                </span>
              )}
              {conversation.unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e41e3f] px-1.5 text-[10px] font-bold text-white">
                  {conversation.unread}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
