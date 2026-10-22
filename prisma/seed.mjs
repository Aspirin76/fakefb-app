/**
 * 種子資料：示範帳號 + NPC 角色 + 示範貼文
 * 執行：npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@fakefb.test";
const DEMO_PASSWORD = "password123";

const NPCS = [
  {
    id: "npc-kui",
    name: "小葵",
    email: "npc-kui@fakebook.local",
    color: "#f58518",
    persona: [
      "個性開朗、好奇心旺盛，愛追問細節。",
      "很愛分享自己逛過的店跟景點，講話帶點俏皮。",
      "遇到不會的就會坦率說「我也不確定」，不裝懂。",
    ].join("\n"),
  },
  {
    id: "npc-zhe",
    name: "阿哲",
    email: "npc-zhe@fakebook.local",
    color: "#8b5cf6",
    persona: [
      "個性沉穩理性，講話簡潔、不浮誇。",
      "喜歡從原理跟經驗的角度分析事情，偶爾會提出相反的觀點。",
      "不太會主動傾倒情緒，但會認真回應對方的困擾。",
    ].join("\n"),
  },
];

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD, 12);

  // 示範帳號
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
        { authorId: user.id, content: "哈囉！這是 FakeBook 的第一則貼文 🎉" },
        { authorId: user.id, content: "歡迎加入 FakeBook，一起來聊天吧！" },
      ],
    });
  }

  // NPC 角色（密碼是隨機值，NPC 不用密碼登入）
  for (const npc of NPCS) {
    await prisma.user.upsert({
      where: { id: npc.id },
      update: { name: npc.name, persona: npc.persona },
      create: {
        id: npc.id,
        name: npc.name,
        email: npc.email,
        passwordHash: await hash(`npc-${npc.id}-${Date.now()}`, 12),
        emailVerified: new Date(),
        isNpc: true,
        persona: npc.persona,
      },
    });
  }

  console.log("種子資料完成：");
  console.log(`  帳號：${DEMO_EMAIL}`);
  console.log(`  密碼：${DEMO_PASSWORD}（已驗證，可直接登入）`);
  console.log(`  NPC ：${NPCS.map((n) => n.name).join("、")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
