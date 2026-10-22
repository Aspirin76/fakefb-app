import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * POST /api/stories/[storyId]/view — 標記看過
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  const { storyId } = await params;

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) {
    return Response.json({ error: "找不到限時動態" }, { status: 404 });
  }

  await prisma.storyView.upsert({
    where: { storyId_userId: { storyId, userId: user.id } },
    update: { viewedAt: new Date() },
    create: { storyId, userId: user.id },
  });

  return Response.json({ ok: true });
}
