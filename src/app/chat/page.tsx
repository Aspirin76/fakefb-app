import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getNpcUsers } from "@/lib/npcs";

export const metadata: Metadata = {
  title: "聊天",
};

// 聊天頁需要登入狀態，允許在請求時阻塞渲染
export const instant = false;

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const npcs = await getNpcUsers();

  // 每個 NPC 對應一段對話，沒有就建一個
  const conversations = await Promise.all(
    npcs.map(async (npc) => {
      const existing = await prisma.conversation.findUnique({
        where: { userId_npcId: { userId: user.id, npcId: npc.id } },
      });
      if (existing) return existing;

      return prisma.conversation.create({
        data: { userId: user.id, npcId: npc.id },
      });
    }),
  );

  const lastMessages = await prisma.message.findMany({
    where: { conversationId: { in: conversations.map((c) => c.id) } },
    orderBy: { createdAt: "desc" },
    take: conversations.length,
  });

  const lastMessageByConversation = new Map(
    lastMessages.map((m) => [m.conversationId, m]),
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold">聊天</h1>
      <p className="mt-1 text-sm text-[#606770]">
        跟 FakeBook 的 NPC 好友聊天，回覆由 OpenCode（AI）即時生成。
      </p>

      <div className="mt-5 space-y-2">
        {npcs.map((npc, index) => {
          const conversation = conversations[index];
          const last = lastMessageByConversation.get(conversation.id);

          return (
            <Link
              key={npc.id}
              href={`/chat/${conversation.id}`}
              className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition hover:shadow"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                style={{ backgroundColor: npc.color }}
              >
                {npc.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{npc.name}</p>
                <p className="truncate text-sm text-[#606770]">
                  {last ? last.content : "開始聊天"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-[#8a8d91]">
                {last ? formatTime(last.createdAt) : ""}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
