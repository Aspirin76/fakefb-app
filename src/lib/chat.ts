import { prisma } from "./prisma";

/**
 * 聊天室的資料存取helper。
 * 把「1 對 1 對話」跟「群組對話」統一用 ConversationMember 處理。
 */

export type ConversationSummary = {
  id: string;
  type: "dm" | "group";
  name: string;
  color: string;
  members: { id: string; name: string; color: string; isNpc: boolean }[];
  lastMessage: {
    id: string;
    content: string;
    type: string;
    createdAt: Date;
    senderName: string;
    mine: boolean;
  } | null;
  unread: number;
  updatedAt: Date;
};

/** 找出（或建立）一段對話 */
export async function ensureConversation({
  userId,
  npcIds,
  name,
}: {
  userId: string;
  npcIds: string[];
  name?: string;
}) {
  const uniqueNpcIds = [...new Set(npcIds)];
  const type = uniqueNpcIds.length > 1 ? "group" : "dm";

  // 先找看看有沒有一樣的對話
  const candidates = await prisma.conversation.findMany({
    where: { userId, type },
    include: { members: true },
  });

  const match = candidates.find(
    (conversation) =>
      conversation.members.length === uniqueNpcIds.length &&
      uniqueNpcIds.every((id) =>
        conversation.members.some((member) => member.userId === id),
      ),
  );

  if (match) return match;

  const conversation = await prisma.conversation.create({
    data: {
      userId,
      type,
      name: name ?? null,
      members: {
        create: uniqueNpcIds.map((npcId) => ({ userId: npcId })),
      },
    },
    include: { members: true },
  });

  return conversation;
}

/** 使用者的所有對話（含未讀數與最後一則訊息） */
export async function getConversationsForUser(
  userId: string,
): Promise<ConversationSummary[]> {
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      members: { include: { user: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: true },
      },
    },
  });

  return Promise.all(
    conversations.map(async (conversation) => {
      const last = conversation.messages[0] ?? null;

      const unread = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: userId },
          readAt: null,
          deletedAt: null,
        },
      });

      const npcMembers = conversation.members
        .filter((m) => m.user.isNpc)
        .map((m) => ({
          id: m.user.id,
          name: m.user.name,
          color: m.user.id === "npc-kui" ? "#f58518" : "#8b5cf6",
          isNpc: true,
        }));

      return {
        id: conversation.id,
        type: (conversation.type as "dm" | "group") ?? "dm",
        name:
          conversation.name ??
          npcMembers.map((m) => m.name).join("、") ??
          "對話",
        color: npcMembers[0]?.color ?? "#1877f2",
        members: npcMembers,
        lastMessage: last
          ? {
              id: last.id,
              content: last.content,
              type: last.type,
              createdAt: last.createdAt,
              senderName: last.sender.name,
              mine: last.senderId === userId,
            }
          : null,
        unread,
        updatedAt: conversation.updatedAt,
      };
    }),
  );
}

/** 取一段對話（檢查是不是這個使用者的） */
export async function getConversationForUser(
  userId: string,
  conversationId: string,
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: { members: { include: { user: true } } },
  });

  if (!conversation) return null;

  return {
    ...conversation,
    npcs: conversation.members
      .filter((m) => m.user.isNpc)
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        color: m.user.id === "npc-kui" ? "#f58518" : "#8b5cf6",
        handle: m.user.id,
        persona: m.user.persona ?? "",
      })),
  };
}

/** 把對話標成已讀 */
export async function markConversationRead(
  userId: string,
  conversationId: string,
) {
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastReadAt: new Date() },
  });
}

/** 前端用的訊息格式 */
export type SerializedMessage = {
  id: string;
  senderId: string;
  type: string;
  content: string;
  replyToId: string | null;
  reactions: Record<string, string>;
  readAt: string | null;
  deletedAt: string | null;
  createdAt: string;
};

type MessageWithSender = {
  id: string;
  senderId: string;
  type: string;
  content: string;
  replyToId: string | null;
  reactions: string;
  readAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
};

/** 把資料庫的訊息轉成前端好用的格式 */
export function serializeMessage(
  message: MessageWithSender,
): SerializedMessage {
  let reactions: Record<string, string> = {};
  try {
    reactions = JSON.parse(message.reactions || "{}");
  } catch {
    reactions = {};
  }

  return {
    id: message.id,
    senderId: message.senderId,
    type: message.type,
    content: message.content,
    replyToId: message.replyToId,
    reactions,
    readAt: message.readAt ? message.readAt.toISOString() : null,
    deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
    createdAt: message.createdAt.toISOString(),
  };
}
