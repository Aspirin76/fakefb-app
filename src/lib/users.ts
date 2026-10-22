/** 使用者頭像的顏色（依 id 固定分配） */
const COLORS = [
  "#1877f2",
  "#42b72a",
  "#f58518",
  "#8b5cf6",
  "#e41e3f",
  "#00a6ed",
  "#f7b928",
  "#0d8a5f",
];

export function userColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

/** 頭像裡顯示的字 */
export function userInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

/** 相對時間（「3 分鐘前」） */
export function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "剛剛";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(date);
}
