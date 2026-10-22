/**
 * 種子資料：建立一個示範帳號 + 幾則貼文
 * 執行：npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@fakefb.test";
const DEMO_PASSWORD = "password123";

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      name: "示範使用者",
      email: DEMO_EMAIL,
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const existing = await prisma.post.count({ where: { authorId: user.id } });
  if (existing === 0) {
    await prisma.post.createMany({
      data: [
        { authorId: user.id, content: "哈囉！這是假FB的第一則貼文 🎉" },
        { authorId: user.id, content: "歡迎加入假FB，一起來聊天吧！" },
      ],
    });
  }

  console.log("種子資料完成：");
  console.log(`  帳號：${DEMO_EMAIL}`);
  console.log(`  密碼：${DEMO_PASSWORD}（已驗證，可直接登入）`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
