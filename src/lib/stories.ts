import { prisma } from "./prisma";

/** 一位作者的限時動態（含看過的狀態） */
export type StoryGroup = {
  authorId: string;
  authorName: string;
  stories: {
    id: string;
    content: string;
    emoji: string | null;
    color: string | null;
    createdAt: Date;
    expiresAt: Date;
    viewed: boolean;
  }[];
};

/**
 * 取得目前有效的限時動態，依作者分組。
 * 過期的（預設 24 小時）會自動消失。
 */
export async function getStoryGroups(userId: string): Promise<StoryGroup[]> {
  const stories = await prisma.story.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
    include: {
      views: { where: { userId }, select: { id: true } },
      author: { select: { id: true, name: true } },
    },
  });

  const groups = new Map<string, StoryGroup>();

  for (const story of stories) {
    const group = groups.get(story.authorId) ?? {
      authorId: story.authorId,
      authorName: story.author.name,
      stories: [],
    };

    group.stories.push({
      id: story.id,
      content: story.content,
      emoji: story.emoji,
      color: story.color,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      viewed: story.views.length > 0,
    });

    groups.set(story.authorId, group);
  }

  // 自己的排前面，沒看過的排前面
  return [...groups.values()].sort((a, b) => {
    const aUnseen = a.stories.some((s) => !s.viewed) ? 0 : 1;
    const bUnseen = b.stories.some((s) => !s.viewed) ? 0 : 1;
    if (aUnseen !== bUnseen) return aUnseen - bUnseen;
    if (a.authorId === userId) return -1;
    if (b.authorId === userId) return 1;
    return a.authorName.localeCompare(b.authorName, "zh-Hant");
  });
}
