/** 毎朝の巡回の状態。混雑予想の取得日（巡回が成功するたびに進む）から、止まっていないかを判断する */
export function patrolStatus(lastYmd: string | null, now: Date): { last: string | null; daysAgo: number; stale: boolean } {
  if (!lastYmd || !/^\d{4}-\d{2}-\d{2}$/.test(lastYmd)) return { last: null, daysAgo: 0, stale: true };
  // 日本時間の今日
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const daysAgo = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastYmd}T00:00:00Z`)) / 86_400_000);
  return { last: lastYmd, daysAgo, stale: daysAgo >= 2 };
}
