import { markConversationRead } from "@/lib/chat";
import { getCurrentUser } from "@/lib/session";

/** POST /api/chat/[conversationId]/read — 把對話標成已讀 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  const { conversationId } = await params;
  await markConversationRead(user.id, conversationId);

  return Response.json({ ok: true });
}
