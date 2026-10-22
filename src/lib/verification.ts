import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 小時

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * 產生一組 Email 驗證 token。
 * 資料庫只存 SHA-256 雜湊，原始 token 只會出現在寄給使用者的連結裡。
 */
export async function createVerificationToken(userId: string) {
  // 同一時間只保留最新的一組 token
  await prisma.verificationToken.deleteMany({ where: { userId } });

  const rawToken = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      token: hashToken(rawToken),
      userId,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  return rawToken;
}

export type VerifyResult =
  | { status: "ok"; userId: string }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "already-verified" };

/** 驗證 Email token，成功時順便把使用者的 emailVerified 標成已驗證 */
export async function verifyEmailToken(rawToken: string): Promise<VerifyResult> {
  if (!rawToken) return { status: "invalid" };

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(rawToken) },
    include: { user: true },
  });

  if (!record) return { status: "invalid" };

  if (record.user.emailVerified) {
    await prisma.verificationToken.deleteMany({ where: { userId: record.userId } });
    return { status: "already-verified" };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.verificationToken.delete({ where: { id: record.id } });
    return { status: "expired" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { id: record.id } }),
  ]);

  return { status: "ok", userId: record.userId };
}
