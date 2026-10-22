import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { serializeMessage } from "@/lib/chat";

/**
 * DELETE /api/chat/[conversationId]/messages/[messageId]
 * 刪除自己的訊息。
 */
export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  const { conversationId, messageId } = await params;

  const message = await prisma.message.findFirst({
    where: { id: messageId, conversationId, senderId: user.id },
  });

  if (!message) {
    return Response.json({ error: "只能刪除自己的訊息" }, { status: 403 });
  }

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { deletedAt: new Date(), content: "" },
  });

  return Response.json({ message: serializeMessage(updated) });
}
