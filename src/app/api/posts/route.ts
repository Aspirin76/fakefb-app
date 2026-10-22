import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/realtime";
import { getCurrentUser } from "@/lib/session";

const bodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "貼文內容不能空白")
    .max(500, "貼文不能超過 500 個字"),
});

/** POST /api/posts — 發貼 */
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

  const post = await prisma.post.create({
    data: { content: parsed.data.content, authorId: user.id },
    include: { author: { select: { id: true, name: true } } },
  });

  publish("post:new", { post });

  return Response.json({ post });
}
