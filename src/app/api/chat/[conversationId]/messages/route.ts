import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/realtime";
import { getCurrentUser } from "@/lib/session";
import { getConversationForUser, serializeMessage } from "@/lib/chat";
import { npcReply, npcSignature } from "@/lib/opencode";

const bodySchema = z.object({
  content: z.string().trim().min(1, "訊息不能空白").max(1000, "訊息不能超過 1000 字"),
  type: z.enum(["text", "sticker", "photo"]).default("text"),
  replyToId: z.string().nullish(),
});

/** GET /api/chat/[conversationId]/messages — 取得對話中的訊息 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: user.id },
  });

  if (!conversation) {
    return Response.json({ error: "找不到這段對話" }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return Response.json({ messages: messages.map(serializeMessage) });
}

/**
 * POST /api/chat/[conversationId]/messages
 * 送一則訊息給 NPC，拿回 NPC 的回覆（群組聊天可能回多則）。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  const { conversationId } = await params;

  const conversation = await getConversationForUser(user.id, conversationId);
  if (!conversation) {
    return Response.json({ error: "找不到這段對話" }, { status: 404 });
  }
  if (conversation.npcs.length === 0) {
    return Response.json({ error: "這段對話沒有 NPC" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "訊息格式不正確" },
      { status: 400 },
    );
  }

  const { content, type, replyToId } = parsed.data;

  // 回覆的訊息必須在這段對話裡
  if (replyToId) {
    const target = await prisma.message.findFirst({
      where: { id: replyToId, conversationId: conversation.id },
    });
    if (!target) {
      return Response.json({ error: "找不到要回覆的訊息" }, { status: 400 });
    }
  }

  // 先把使用者訊息存起來
  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: user.id,
      content,
      type,
      replyToId: replyToId ?? null,
      readAt: new Date(),
    },
  });

  // 叫 AI 回覆
  const isGroup = conversation.npcs.length > 1;
  const configHash = npcSignature(conversation.npcs, isGroup);
  const sessionId =
    conversation.opencodeConfigHash === configHash
      ? conversation.opencodeSessionId
      : null;

  let replies;
  try {
    const result = await npcReply({
      npcs: conversation.npcs,
      isGroup,
      sessionId,
      message: content,
    });
    replies = result.replies;

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        opencodeSessionId: result.sessionId,
        opencodeConfigHash: configHash,
      },
    });
  } catch (error) {
    console.error("[chat] NPC 回覆失敗:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "AI 回覆失敗，請稍後再試一次。",
        userMessage: serializeMessage(userMessage),
      },
      { status: 502 },
    );
  }

  // 把 AI 的回覆存成訊息
  const npcMessages = await Promise.all(
    replies.map((reply) =>
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: reply.senderId,
          content: reply.content,
          type: "text",
        },
      }),
    ),
  );

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  const payload = {
    userMessage: serializeMessage(userMessage),
    npcMessages: npcMessages.map(serializeMessage),
  };

  // 廣播給其他連線中的用戶
  publish("chat:new", { conversationId: conversation.id, ...payload }, user.id);

  return Response.json(payload);
}
