import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getConversationForUser, serializeMessage } from "@/lib/chat";

export const metadata: Metadata = {
  title: "聊天",
};

// 聊天頁需要登入狀態，允許在請求時阻塞渲染
export const instant = false;

export default async function ConversationPage(
  props: PageProps<"/chat/[conversationId]">,
) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { conversationId } = await props.params;

  const conversation = await getConversationForUser(user.id, conversationId);
  if (!conversation) {
    notFound();
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const title =
    conversation.name ??
    conversation.npcs.map((npc) => npc.name).join("、");

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-2xl flex-col px-4 py-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#dddfe2] p-3">
          <Link
            href="/chat"
            className="rounded-md px-2 py-1 text-lg text-[#606770] hover:bg-[#f0f2f5]"
            aria-label="回到聊天列表"
          >
            ←
          </Link>

          {conversation.npcs.length > 1 ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8b5cf6] text-base text-white">
              👥
            </span>
          ) : (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white"
              style={{ backgroundColor: conversation.npcs[0]?.color ?? "#1877f2" }}
            >
              {conversation.npcs[0]?.name.slice(0, 1) ?? "?"}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{title}</p>
            <p className="text-xs text-[#8a8d91]">
              {conversation.npcs.length > 1
                ? `${conversation.npcs.map((n) => n.name).join("、")} · AI 群組聊天`
                : "AI 角色 · 由 OpenCode 驅動"}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <ChatPanel
            conversationId={conversation.id}
            currentUser={{ id: user.id, name: user.name }}
            participants={conversation.npcs.map((npc) => ({
              id: npc.id,
              name: npc.name,
              color: npc.color,
            }))}
            initialMessages={messages.map(serializeMessage)}
          />
        </div>
      </div>
    </div>
  );
}
