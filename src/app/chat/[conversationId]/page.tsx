import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getNpc } from "@/lib/npcs";

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

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.userId !== user.id) {
    notFound();
  }

  const npc = await getNpc(conversation.npcId);
  if (!npc) {
    notFound();
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#dddfe2] p-4">
          <Link
            href="/chat"
            className="rounded-md px-2 py-1 text-sm font-semibold text-[#606770] hover:bg-[#f0f2f5]"
          >
            ←
          </Link>
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white"
            style={{ backgroundColor: npc.color }}
          >
            {npc.name.slice(0, 1)}
          </span>
          <div>
            <p className="font-semibold">{npc.name}</p>
            <p className="text-xs text-[#8a8d91]">AI 角色 · 由 OpenCode 驅動</p>
          </div>
        </div>

        <div className="h-[60vh] min-h-[420px]">
          <ChatPanel
            conversationId={conversation.id}
            npc={{ id: npc.id, name: npc.name, color: npc.color }}
            currentUserId={user.id}
            initialMessages={messages.map((m) => ({
              id: m.id,
              senderId: m.senderId,
              content: m.content,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
