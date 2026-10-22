import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/realtime";
import { getCurrentUser } from "@/lib/session";

const bodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "留言不能空白")
    .max(300, "留言不能超過 300 個字"),
});

/** POST /api/posts/[postId]/comments — 留言 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  const { postId } = await params;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return Response.json({ error: "找不到貼文" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "留言格式不正確" },
      { status: 400 },
    );
  }

  const comment = await prisma.comment.create({
    data: { postId, userId: user.id, content: parsed.data.content },
    include: { user: { select: { id: true, name: true } } },
  });

  const commentCount = await prisma.comment.count({ where: { postId } });
  publish("post:update", { postId, commentCount });

  return Response.json({ comment, commentCount });
}
