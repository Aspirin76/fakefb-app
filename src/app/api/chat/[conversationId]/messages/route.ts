import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getNpc } from "@/lib/npcs";
import { npcReply, npcSignature } from "@/lib/opencode";

const bodySchema = z.object({
  content: z.string().trim().min(1, "訊息不能空白").max(1000, "訊息不能超過 1000 字"),
});

/**
 * POST /api/chat/[conversationId]/messages
 * 送一則訊息給 NPC，拿回 NPC 的回覆。
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

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.userId !== user.id) {
    return Response.json({ error: "找不到這段對話" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "訊息格式不正確" },
      { status: 400 },
    );
  }

  const npc = await getNpc(conversation.npcId);
  if (!npc) {
    return Response.json({ error: "找不到這個 NPC" }, { status: 404 });
  }

  // 先把使用者訊息存起來
  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: user.id,
      content: parsed.data.content,
    },
  });

  // 叫 AI 回覆
  let reply: string;

  // 人設（prompt）改了就要開新的 OpenCode session，否則舊的 context 會讓 AI 繼續用舊角色
  const configHash = npcSignature(npc);
  const sessionId =
    conversation.opencodeConfigHash === configHash
      ? conversation.opencodeSessionId
      : null;

  try {
    const result = await npcReply({
      npc,
      sessionId,
      message: parsed.data.content,
    });
    reply = result.reply;

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
        userMessage,
      },
      { status: 502 },
    );
  }

  const npcMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: npc.id,
      content: reply,
    },
  });

  return Response.json({ userMessage, npcMessage });
}
