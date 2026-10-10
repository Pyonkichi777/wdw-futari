import type { NewsItem } from "./news";

const KEY = "wdw-futari:news:seen";

/** バッジに数える「重要なニュース」（参考・旅行期間外は数えない） */
export const isImportant = (n: NewsItem): boolean => n.impact !== "low" && n.overlapsTrip !== "no";

/** まだ見ていない重要なニュースの数 */
export const unseenCount = (items: readonly NewsItem[], seen: ReadonlySet<string>): number =>
  items.filter((n) => isImportant(n) && !seen.has(n.id)).length;

/** 既読にしたニュースのID（この端末に保存） */
export function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveSeen(seen: ReadonlySet<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {
    // 保存できない環境では、開いている間だけ既読扱い
  }
}
