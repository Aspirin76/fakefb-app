import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "fakefb_session";
const SESSION_TTL_DAYS = 7;

function expiresAt() {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** 建立一筆登入紀錄並把 session id 寫進 httpOnly cookie */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const session = await prisma.session.create({
    data: { token, userId, expiresAt: expiresAt() },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });

  return session;
}

/** 讀出目前登入中的使用者（沒有登入則回傳 null） */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

/** 登出：刪掉資料庫的 session 與瀏覽器 cookie */
export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  cookieStore.delete(SESSION_COOKIE);
}
