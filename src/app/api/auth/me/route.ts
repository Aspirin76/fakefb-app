import { getCurrentUser } from "@/lib/session";

/** 給前端 navbar 用的「現在是誰登入」資訊 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ user: null });
  }

  return Response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
}
