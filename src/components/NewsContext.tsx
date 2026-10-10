import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchNews, type NewsFeed } from "../lib/news";

interface NewsState {
  feed: NewsFeed | null;
  error: string | null;
  reload: () => void;
}

const Ctx = createContext<NewsState>({ feed: null, error: null, reload: () => undefined });

export function NewsProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
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
  return <Ctx.Provider value={{ feed, error, reload: () => setTick((t) => t + 1) }}>{children}</Ctx.Provider>;
}

export const useNews = (): NewsState => useContext(Ctx);
