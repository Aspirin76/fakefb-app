import { getCurrentUser } from "@/lib/session";
import {
  getOnlineUsers,
  setOffline,
  setOnline,
  subscribe,
} from "@/lib/realtime";

/**
 * GET /api/events —— Server-Sent Events 即時推播
 *
 * 會推送：
 *   presence      目前在線的人
 *   post:new      有新貼文
 *   post:update   貼文被按讚 / 留言
 *   story:new     有新限時動態
 *   chat:new      有新訊息
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (event: { type: string; data: unknown }) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };

      // 先訂閱再廣播上線狀態，否則自己會收不到自己上線的事件
      const unsubscribe = subscribe((event) => {
        if (event.to && event.to !== user?.id) return;
        send({ type: event.type, data: event.data });
      });

      // 未登入也允許連線（只是收不到個人訊息）
      if (user) setOnline(user.id);

      send({ type: "hello", data: { online: getOnlineUsers() } });

      // 心跳，避免連線被中介層切掉
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        if (user) setOffline(user.id);
        try {
          controller.close();
        } catch {
          /* 已經關了 */
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
