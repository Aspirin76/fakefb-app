import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client 單例。
 * 開發模式下 Next.js 會熱重載模組，若不快取 instance 會不斷開新的資料庫連線。
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
