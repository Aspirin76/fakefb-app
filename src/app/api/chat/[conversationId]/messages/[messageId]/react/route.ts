import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { serializeMessage } from "@/lib/chat";

const bodySchema = z.object({
  emoji: z.string().trim().min(1).max(8),
});

/**
 * POST /api/chat/[conversationId]/messages/[messageId]/react
 * 對訊息加表情（再按一次取消）。
 */
export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  const { conversationId, messageId } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: user.id },
  });
  if (!conversation) {
    return Response.json({ error: "找不到這段對話" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "請選擇表情" }, { status: 400 });
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, conversationId },
  });
  if (!message) {
    return Response.json({ error: "找不到訊息" }, { status: 404 });
  }

  let reactions: Record<string, string> = {};
  try {
    reactions = JSON.parse(message.reactions || "{}");
  } catch {
    reactions = {};
  }

  if (reactions[user.id] === parsed.data.emoji) {
    delete reactions[user.id];
  } else {
    reactions[user.id] = parsed.data.emoji;
  }

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { reactions: JSON.stringify(reactions) },
  });

  return Response.json({ message: serializeMessage(updated) });
}
