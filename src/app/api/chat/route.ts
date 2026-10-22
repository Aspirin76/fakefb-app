import { z } from "zod";
import { ensureConversation } from "@/lib/chat";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  npcIds: z.array(z.string()).min(1, "請選擇至少一位對話對象").max(5),
  name: z.string().trim().max(30).optional(),
});

/** POST /api/chat — 建立 1 對 1 或群組對話 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "參數不正確" },
      { status: 400 },
    );
  }

  // 只能跟 NPC 對話
  const npcCount = await prisma.user.count({
    where: { id: { in: parsed.data.npcIds }, isNpc: true },
  });

  if (npcCount !== parsed.data.npcIds.length) {
    return Response.json({ error: "對象不存在" }, { status: 400 });
  }

  const conversation = await ensureConversation({
    userId: user.id,
    npcIds: parsed.data.npcIds,
    name: parsed.data.name,
  });

  return Response.json({ conversationId: conversation.id });
}
