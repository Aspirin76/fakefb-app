import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/realtime";
import { getCurrentUser } from "@/lib/session";

/**
 * POST /api/posts/[postId]/like — 按讚 / 取消按讚
 */
export async function POST(
  _request: Request,
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

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
  });

  if (existing) {
    await prisma.postLike.delete({
      where: { postId_userId: { postId, userId: user.id } },
    });
  } else {
    await prisma.postLike.create({ data: { postId, userId: user.id } });
  }

  const likeCount = await prisma.postLike.count({ where: { postId } });
  publish("post:update", { postId, likeCount });

  return Response.json({
    liked: !existing,
    likeCount,
  });
}
