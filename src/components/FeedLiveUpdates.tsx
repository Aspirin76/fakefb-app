"use client";

import { useAutoRefresh } from "@/components/RealtimeProvider";

/**
 * 動態牆的即時更新。
 * 有人發貼 / 按讚 / 留言 / 發限時動態時，自動重新載入頁面。
 */
export function FeedLiveUpdates() {
  useAutoRefresh(["post:new", "post:update", "story:new"]);
  return null;
}
