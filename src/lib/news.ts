import type { Ride } from "../types";

export type Impact = "high" | "medium" | "low";
export type NewsCategory = "ride" | "transport" | "show" | "hotel" | "ticket" | "other";
export type Overlap = "yes" | "maybe" | "no";

export interface NewsItem {
  id: string;
  /** 記事・発表の日付（YYYY-MM-DD） */
  publishedAt: string;
  title: string;
  summary: string;
  impact: Impact;
  category: NewsCategory;
  /** 関係するアトラクションのID（図鑑のカードに印を出す） */
  rideIds: string[];
  period: { from: string | null; to: string | null } | null;
  /** 旅行期間（4/29〜5/7）に重なるか */
  overlapsTrip: Overlap;
  /** 計画への影響と、やること */
  action: string;
  sources: { title: string; url: string }[];
}

export interface NewsFeed {
  updatedAt: string;
  items: NewsItem[];
}

export const IMPACT_LABEL: Record<Impact, string> = { high: "要対応", medium: "注意", low: "参考" };
export const CATEGORY_LABEL: Record<NewsCategory, string> = {
  ride: "アトラクション",
  transport: "交通",
  show: "ショー・パレード",
  hotel: "ホテル",
  ticket: "チケット・パス",
  other: "その他",
};
export const OVERLAP_LABEL: Record<Overlap, string> = { yes: "旅行期間に影響", maybe: "旅行期間に影響する可能性", no: "旅行期間外" };

const IMPACT_ORDER: Record<Impact, number> = { high: 0, medium: 1, low: 2 };

const isStr = (v: unknown): v is string => typeof v === "string";

function parseItem(v: unknown): NewsItem | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const impact = o.impact === "high" || o.impact === "medium" || o.impact === "low" ? o.impact : null;
  const category = (["ride", "transport", "show", "hotel", "ticket", "other"] as const).find((c) => c === o.category) ?? "other";
  const overlap = o.overlapsTrip === "yes" || o.overlapsTrip === "maybe" || o.overlapsTrip === "no" ? o.overlapsTrip : "maybe";
  if (!isStr(o.id) || !isStr(o.title) || !isStr(o.summary) || !isStr(o.publishedAt) || !impact) return null;
  const p = o.period as Record<string, unknown> | null | undefined;
  const sources = Array.isArray(o.sources)
    ? o.sources.flatMap((s: unknown) => {
        const r = s as Record<string, unknown>;
        return typeof s === "object" && s !== null && isStr(r.title) && isStr(r.url) && r.url.startsWith("https://") ? [{ title: r.title, url: r.url }] : [];
      })
    : [];
  return {
    id: o.id,
    publishedAt: o.publishedAt,
    title: o.title,
    summary: o.summary,
    impact,
    category,
    rideIds: Array.isArray(o.rideIds) ? o.rideIds.filter(isStr) : [],
    period: p && typeof p === "object" ? { from: isStr(p.from) ? p.from : null, to: isStr(p.to) ? p.to : null } : null,
    overlapsTrip: overlap,
    action: isStr(o.action) ? o.action : "",
    sources,
  };
}

/** news.json を読み取る（壊れた項目は捨てる） */
export function parseFeed(data: unknown): NewsFeed {
  const o = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  const items = Array.isArray(o.items) ? o.items.map(parseItem).filter((x): x is NewsItem => x !== null) : [];
  return { updatedAt: isStr(o.updatedAt) ? o.updatedAt : "", items: sortNews(items) };
}

/** 重要度 → 旅行への影響 → 新しい順 */
export function sortNews(items: readonly NewsItem[]): NewsItem[] {
  const ov: Record<Overlap, number> = { yes: 0, maybe: 1, no: 2 };
  return [...items].sort(
    (a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || ov[a.overlapsTrip] - ov[b.overlapsTrip] || b.publishedAt.localeCompare(a.publishedAt),
  );
}

/** そのアトラクションに関係する、旅行期間外ではないニュース */
export const newsForRide = (ride: Ride, items: readonly NewsItem[]): NewsItem[] =>
  items.filter((n) => n.rideIds.includes(ride.id) && n.overlapsTrip !== "no");

export async function fetchNews(): Promise<NewsFeed> {
  const res = await fetch(`${import.meta.env.BASE_URL}news.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`ニュースを読み込めませんでした（${res.status}）`);
  return parseFeed(await res.json());
}
