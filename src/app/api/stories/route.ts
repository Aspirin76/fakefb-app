import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/realtime";
import { getCurrentUser } from "@/lib/session";

const bodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "說點什麼吧")
    .max(120, "限時動態不能超過 120 個字"),
  emoji: z.string().trim().max(4).optional(),
  color: z.string().trim().max(9).optional(),
});

const STORY_TTL_HOURS = 24;

/** POST /api/stories — 發一則限時動態 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "內容格式不正確" },
      { status: 400 },
    );
  }

  const story = await prisma.story.create({
    data: {
      authorId: user.id,
      content: parsed.data.content,
      emoji: parsed.data.emoji ?? null,
      color: parsed.data.color ?? null,
      expiresAt: new Date(Date.now() + STORY_TTL_HOURS * 60 * 60 * 1000),
    },
    include: { author: { select: { id: true, name: true } } },
  });

  publish("story:new", { story });

  return Response.json({ story });
}
