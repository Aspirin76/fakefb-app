"use client";

import { useRealtime } from "@/components/RealtimeProvider";

/**
 * 「現在上線」名單。
 * 上線狀態是靠 SSE 連線判斷的，有人連線就會廣播 presence 事件。
 */
export function OnlineFriends({
  users,
  currentUserId,
}: {
  users: { id: string; name: string; color: string }[];
  currentUserId: string;
}) {
  const { online, connected } = useRealtime();

  const onlineUsers = users.filter((user) => online.includes(user.id));

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">現在上線</h2>
        <span
          className={`flex items-center gap-1 text-xs ${
            connected ? "text-[#42b72a]" : "text-[#8a8d91]"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-[#42b72a]" : "bg-[#8a8d91]"
            }`}
          />
          {connected ? "即時連線中" : "連線中…"}
        </span>
      </div>

      {onlineUsers.length === 0 ? (
        <p className="mt-3 text-sm text-[#606770]">
          現在只有你一個人在線。
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {onlineUsers.map((user) => (
            <li key={user.id} className="flex items-center gap-2">
              <span className="relative">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#42b72a]" />
              </span>
              <span className="text-sm">
                {user.name}
                {user.id === currentUserId && (
                  <span className="ml-1 text-xs text-[#8a8d91]">（你）</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 border-t border-[#eee] pt-2 text-xs text-[#8a8d91]">
        限時動態、按讚、留言都會即時更新，不用重新整理。
      </p>
    </div>
  );
}
