import type { ParkId } from "../types";

/**
 * パーク×日付の混雑予想（ざっくり）。2027年の公式の混雑予想ではなく、一般的な傾向から作った目安。
 * - 曜日: 土がいちばん混み、水がいちばん空く（Magic Tips の2027年5月の予想と同じ傾向）
 * - パーク: マジックキングダムとハリウッド・スタジオは混みやすく、アニマルキングダムは空きやすい
 * - 行事: エプコットはフラワー＆ガーデン・フェスティバル（2027年は3/10〜5/31の報道）の週末に地元客で混む。
 *   5/4（スター・ウォーズの日）はハリウッド・スタジオがとても混む
 * 出発1ヶ月前に、混雑予想カレンダーで確かめ直す
 */

/** 曜日ごとの混み具合（0=日 … 6=土） */
export const DAY_CROWD: Record<number, number> = { 0: 4, 1: 3, 2: 2, 3: 1.8, 4: 2.5, 5: 3.5, 6: 5 };
const PARK_ADJ: Record<ParkId, number> = { MK: 0.5, HS: 0.5, EP: 0, AK: -0.5 };

export const STAR_WARS_DAY = "2027-05-04";
const FLOWER_GARDEN = { from: "2027-03-10", to: "2027-05-31" };

const weekday = (iso: string): number => new Date(`${iso}T12:00:00Z`).getUTCDay();
export const isWeekend = (iso: string): boolean => weekday(iso) === 0 || weekday(iso) === 6;

export type CrowdLevel = "low" | "mid" | "high" | "peak";
export const CROWD_LABEL: Record<CrowdLevel, string> = { low: "空き気味", mid: "ふつう", high: "混む", peak: "とても混む" };
export const CROWD_ICON: Record<CrowdLevel, string> = { low: "🟢", mid: "🟡", high: "🟠", peak: "🔴" };

export interface CrowdInfo {
  score: number;
  level: CrowdLevel;
  reasons: string[];
}

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

export function crowdInfo(park: ParkId, iso: string): CrowdInfo {
  const wd = weekday(iso);
  let score = (DAY_CROWD[wd] ?? 3) + PARK_ADJ[park];
  const reasons: string[] = [];
  if (wd === 6) reasons.push("土曜はいちばん混む");
  else if (wd === 0) reasons.push("日曜は混みやすい");
  else if (wd === 3) reasons.push("水曜はいちばん空きやすい");
  else if (wd === 2) reasons.push("火曜は空きやすい");
  else reasons.push(`${WEEKDAY_JA[wd]}曜はふつう`);
  if (park === "EP" && isWeekend(iso) && iso >= FLOWER_GARDEN.from && iso <= FLOWER_GARDEN.to) {
    score += 1;
    reasons.push("フラワー＆ガーデンの週末は地元客で混む");
  }
  if (park === "HS" && iso === STAR_WARS_DAY) {
    score += 3;
    reasons.push("5/4はスター・ウォーズの日で特に混む");
  }
  if (PARK_ADJ[park] > 0) reasons.push("人気パーク");
  if (PARK_ADJ[park] < 0) reasons.push("比較的すいているパーク");
  const level: CrowdLevel = score < 2.5 ? "low" : score < 3.6 ? "mid" : score < 5 ? "high" : "peak";
  return { score, level, reasons };
}

export const crowdScore = (park: ParkId, iso: string): number => crowdInfo(park, iso).score;

export const CROWD_SOURCE = { label: "Magic Tips（2027年5月の混雑予想）", url: "https://magic-tips.app/en/crowd-calendar/walt-disney-world/2027/may" };
