import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchNews, type NewsFeed } from "../lib/news";
import { loadSeen, saveSeen, unseenCount } from "../lib/newsSeen";

interface NewsState {
  feed: NewsFeed | null;
  error: string | null;
  reload: () => void;
  /** 既読にしたニュースのID */
  seen: ReadonlySet<string>;
  /** まだ見ていない重要なニュースの数（タブのバッジ） */
  unseen: number;
  /** いま届いているニュースをすべて既読にする */
  markAllSeen: () => void;
}

const Ctx = createContext<NewsState>({
  feed: null,
  error: null,
  reload: () => undefined,
  seen: new Set(),
  unseen: 0,
  markAllSeen: () => undefined,
});

export function NewsProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [seen, setSeen] = useState<Set<string>>(loadSeen);
  useEffect(() => {
    let alive = true;
    fetchNews().then(
      (f) => alive && (setFeed(f), setError(null)),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : "ニュースを読み込めませんでした"),
    );
    return () => {
      alive = false;
    };
  }, [tick]);
  const markAllSeen = (): void => {
    if (!feed) return;
    const next = new Set(seen);
    let changed = false;
    for (const n of feed.items) {
      if (!next.has(n.id)) {
        next.add(n.id);
        changed = true;
      }
    }
    if (!changed) return;
    saveSeen(next);
    setSeen(next);
  };
  const unseen = feed ? unseenCount(feed.items, seen) : 0;
  return (
    <Ctx.Provider value={{ feed, error, reload: () => setTick((t) => t + 1), seen, unseen, markAllSeen }}>{children}</Ctx.Provider>
  );
}

export const useNews = (): NewsState => useContext(Ctx);
