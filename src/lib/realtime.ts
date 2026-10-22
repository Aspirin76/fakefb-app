import { EventEmitter } from "node:events";

/**
 * 即時推播（SSE）的事件匯流排。
 *
 * 這是單機的記憶體實作：同一個 Node 行程內的事件可以互相廣播。
 * 如果之後要部署成多台機器，需要換成 Redis Pub/Sub 之類的方案。
 */

export type RealtimeEvent = {
  type: string;
  data: unknown;
  /** 指定只推給某個使用者（不填就是 everybody） */
  to?: string;
};

type Bus = {
  emitter: EventEmitter;
  online: Set<string>;
};

const globalForBus = globalThis as unknown as { __fakebookBus?: Bus };

const bus: Bus = (globalForBus.__fakebookBus ??= {
  emitter: new EventEmitter(),
  online: new Set(),
});

// 預設最多 100 個監聽者，避免警告
bus.emitter.setMaxListeners(100);

/** 廣播一個事件 */
export function publish(type: string, data: unknown, to?: string) {
  bus.emitter.emit("event", { type, data, to } satisfies RealtimeEvent);
}

/** 訂閱事件，回傳取消訂閱的函式 */
export function subscribe(handler: (event: RealtimeEvent) => void) {
  bus.emitter.on("event", handler);
  return () => bus.emitter.off("event", handler);
}

/** 標記某人上線 */
export function setOnline(userId: string) {
  const was = bus.online.has(userId);
  bus.online.add(userId);
  if (!was) publish("presence", { online: getOnlineUsers() });
  return was;
}

/** 標記某人離線 */
export function setOffline(userId: string) {
  const had = bus.online.delete(userId);
  if (had) publish("presence", { online: getOnlineUsers() });
  return had;
}

/** 目前在線的使用者 id */
export function getOnlineUsers() {
  return [...bus.online];
}
