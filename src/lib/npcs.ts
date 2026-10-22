import { prisma } from "./prisma";

/**
 * FakeBook 的 NPC 角色設定。
 *
 * 每個 NPC 的 id 同時當作 OpenCode 工作目錄的名稱，
 * 讓不同 NPC 有各自的人設與對話紀錄。
 */
export const NPC_DEFINITIONS = [
  {
    id: "npc-kui",
    name: "小葵",
    email: "npc-kui@fakebook.local",
    color: "#f58518",
    handle: "kui",
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
    handle: "zhe",
    persona: [
      "個性沉穩理性，講話簡潔、不浮誇。",
      "喜歡從原理跟經驗的角度分析事情，偶爾會提出相反的觀點。",
      "不太會主動傾倒情緒，但會認真回應對方的困擾。",
    ].join("\n"),
  },
] as const;

export type NpcDefinition = (typeof NPC_DEFINITIONS)[number];

/** NPC 的基本資料（給前端用） */
export type NpcInfo = {
  id: string;
  name: string;
  color: string;
  handle: string;
  persona: string;
};

/** 把資料庫裡的 NPC 使用者取出來 */
export async function getNpcUsers(): Promise<NpcInfo[]> {
  const npcs = await prisma.user.findMany({
    where: { isNpc: true },
    orderBy: { createdAt: "asc" },
  });

  return npcs.map((npc) => {
    const def = NPC_DEFINITIONS.find((d) => d.id === npc.id);
    return {
      id: npc.id,
      name: npc.name,
      color: def?.color ?? "#1877f2",
      handle: def?.handle ?? npc.id,
      persona: npc.persona ?? "",
    };
  });
}

/** 取得單一 NPC */
export async function getNpc(npcId: string): Promise<NpcInfo | null> {
  const npc = await prisma.user.findFirst({
    where: { id: npcId, isNpc: true },
  });

  if (!npc) return null;

  const def = NPC_DEFINITIONS.find((d) => d.id === npc.id);
  return {
    id: npc.id,
    name: npc.name,
    color: def?.color ?? "#1877f2",
    handle: def?.handle ?? npc.id,
    persona: npc.persona ?? "",
  };
}
