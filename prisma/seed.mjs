/**
 * 種子資料：示範帳號 + NPC 角色 + 示範貼文 / 留言 / 按讚 / 限時動態
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

const HOUR = 60 * 60 * 1000;

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

  // 示範貼文（只在沒有貼文時建立）
  const postCount = await prisma.post.count();
  if (postCount === 0) {
    const posts = await Promise.all(
      [
        {
          content: "哈囉！這是 FakeBook 的第一則貼文 🎉\n歡迎大家來聊天～",
          minutesAgo: 42,
        },
        {
          content: "今天天氣不錯，出去走了走 🌤️ 有沒有人也想去？",
          minutesAgo: 180,
        },
        {
          content: "試試看按讚跟留言的功能 👇",
          minutesAgo: 320,
        },
      ].map((item) =>
        prisma.post.create({
          data: {
            content: item.content,
            authorId: user.id,
            createdAt: new Date(Date.now() - item.minutesAgo * 60 * 1000),
          },
        }),
      ),
    );

    // NPC 的留言
    await prisma.comment.create({
      data: {
        postId: posts[0].id,
        userId: "npc-kui",
        content: "哇～第一篇！我先按一個愛心 ❤️",
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    });

    await prisma.comment.create({
      data: {
        postId: posts[0].id,
        userId: "npc-zhe",
        content: "歡迎加入，版面很清楚 👍",
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    });

    await prisma.comment.create({
      data: {
        postId: posts[2].id,
        userId: user.id,
        content: "按讚功能測試中～",
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    });

    // 按讚
    for (const post of posts) {
      for (const userId of ["npc-kui", "npc-zhe"]) {
        await prisma.postLike.create({ data: { postId: post.id, userId } });
      }
    }
  }

  // 示範限時動態
  const storyCount = await prisma.story.count();
  if (storyCount === 0) {
    const stories = [
      { authorId: user.id, content: "早安，今天也要加油！", emoji: "🌄", color: "#f58518", hoursAgo: 1 },
      { authorId: "npc-kui", content: "剛剛去了一家超好吃的早餐店 🥐", emoji: "☕", color: "#f58518", hoursAgo: 2 },
      { authorId: "npc-zhe", content: "山上的雲海，今天很值得早起 🌊", emoji: "🌊", color: "#8b5cf6", hoursAgo: 3 },
    ];

    for (const story of stories) {
      await prisma.story.create({
        data: {
          authorId: story.authorId,
          content: story.content,
          emoji: story.emoji,
          color: story.color,
          createdAt: new Date(Date.now() - story.hoursAgo * HOUR),
          expiresAt: new Date(Date.now() + 20 * HOUR),
        },
      });
    }
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
