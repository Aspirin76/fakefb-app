"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Handler = (type: string, data: unknown) => void;

type RealtimeContextValue = {
  /** 註冊事件監聽，回傳取消註冊的函式 */
  subscribe: (handler: Handler) => () => void;
  /** 目前在線的使用者 id */
  online: string[];
  /** 連線狀態 */
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  subscribe: () => () => {},
  online: [],
  connected: false,
});

/**
 * 即時推播的 Provider。
 *
 * 開一條 SSE 連線到 /api/events，收到事件時：
 *   - post / story / chat 相關 → router.refresh() 讓伺服器元件重跑
 *   - presence → 更新在線名單
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const handlers = useRef(new Set<Handler>());
  const [online, setOnline] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    const source = new EventSource("/api/events");

    const dispatch = (type: string, raw: string) => {
      let data: unknown = raw;
      try {
        data = JSON.parse(raw);
      } catch {
        /* 保持字串 */
      }

      if (type === "presence" || type === "hello") {
        const payload = data as { online?: string[] };
        setOnline(payload.online ?? []);
      }

      for (const handler of handlers.current) handler(type, data);
    };

    const types = [
      "hello",
      "presence",
      "post:new",
      "post:update",
      "story:new",
      "chat:new",
    ];

    for (const type of types) {
      source.addEventListener(type, (event) => {
        if (type === "hello") setConnected(true);
        dispatch(type, (event as MessageEvent).data);
      });
    }

    source.onerror = () => {
      setConnected(false);
    };

    source.onopen = () => {
      setConnected(true);
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, []);

  const subscribe = useCallback((handler: Handler) => {
    handlers.current.add(handler);
    return () => {
      handlers.current.delete(handler);
    };
  }, []);

  const value = useMemo(
    () => ({ subscribe, online, connected }),
    [subscribe, online, connected],
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}

/**
 * 當伺服器有新的貼文 / 留言 / 動態時，自動重新整理頁面。
 */
export function useAutoRefresh(types: string[] = []) {
  const { subscribe } = useRealtime();
  const router = useRouter();
  const key = types.join(",");

  useEffect(() => {
    const watched = key ? key.split(",") : [];
    if (watched.length === 0) return;

    return subscribe((type) => {
      if (watched.includes(type)) {
        router.refresh();
      }
    });
  }, [subscribe, router, key]);
}
