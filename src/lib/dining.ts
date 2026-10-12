import { MEAL_LABEL, PRICE_LABEL, STYLE_LABEL } from "../data/dining";
import { parkName } from "../data/parks";
import type { DiningInfo, MealPeriod, Ride } from "../types";
import type { AccessLine } from "./access";
import { matchesQuery } from "./search";

/** ディズニーの食事予約は、直営ホテル宿泊者ならチェックイン日の60日前・朝6時（米東部時間）から滞在全日分（最大10日）を予約できる */
export const BOOKING_DAYS_BEFORE = 60;

/** Lightning Lane は、直営ホテル宿泊者ならチェックイン日の7日前・朝7時（米東部時間）から滞在全日分を予約できる */
export const LL_DAYS_BEFORE = 7;

/**
 * チェックイン日の daysBefore 日前・米東部 etHour 時（その瞬間の日時）。
 * checkIn は "YYYY-MM-DD"。米東部の夏時間かどうかは Intl に任せる
 */
export function opensAt(checkIn: string, daysBefore: number, etHour: number): Date {
  const [y, m, d] = checkIn.split("-").map(Number) as [number, number, number];
  const day = new Date(Date.UTC(y, m - 1, d - daysBefore));
  // その日の米東部の時差（夏時間なら4時間、標準時間なら5時間）を、正午の時刻から求める
  const probe = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12));
  const probeEt = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(probe));
  const offset = 12 - probeEt;
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), etHour + offset));
}

/** 日本時間の表示（例: 2027年3月1日(月) 20:00） */
export const jstText = (at: Date): string =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(at);

export function opensJst(checkIn: string, daysBefore: number, etHour: number): string {
  return jstText(opensAt(checkIn, daysBefore, etHour));
}

/** レストラン予約の開始（チェックイン60日前・米東部6時） */
export const bookingOpensAt = (checkIn: string): Date => opensAt(checkIn, BOOKING_DAYS_BEFORE, 6);
export const bookingOpensJst = (checkIn: string): string => opensJst(checkIn, BOOKING_DAYS_BEFORE, 6);

/** Lightning Lane 予約の開始（チェックイン7日前・米東部7時） */
export const lightningLaneOpensAt = (checkIn: string): Date => opensAt(checkIn, LL_DAYS_BEFORE, 7);
export const lightningLaneOpensJst = (checkIn: string): string => opensJst(checkIn, LL_DAYS_BEFORE, 7);

const BOOKING_TEXT: Record<DiningInfo["booking"], (walkUp: boolean) => string> = {
  disney: (walkUp) => `できる（公式アプリで${BOOKING_DAYS_BEFORE}日前から）${walkUp ? "。満席なら当日の空き待ちリストも使える" : ""}`,
  hotel: () => "できる（ディズニーではなくホテル側で予約。方法は公式ページで確認）",
  none: () => "なし（予約できない。行ってカウンターで注文、またはアプリのモバイルオーダー）",
};

/** 予約の短い表示（カードの印） */
export const BOOKING_CHIP: Record<DiningInfo["booking"], string> = {
  disney: "予約できる（60日前から）",
  hotel: "予約はホテル側",
  none: "予約不要（フードコート）",
};

export type DiningArea = "ALL" | "park" | "resort";
export type DiningType = "ALL" | "character" | "plain";

export interface DiningFilter {
  type: DiningType;
  area: DiningArea;
  meal: MealPeriod | "ALL";
  q: string;
}

export function filterDining(list: readonly Ride[], f: DiningFilter): Ride[] {
  return list.filter((r) => {
    const d = r.dining;
    if (!d) return false;
    if (f.type === "character" && !d.characters) return false;
    if (f.type === "plain" && d.characters) return false;
    if (f.area === "park" && !d.inPark) return false;
    if (f.area === "resort" && d.inPark) return false;
    if (f.meal !== "ALL" && !d.meals.includes(f.meal)) return false;
    return matchesQuery(r, f.q);
  });
}

/** 場所の表示（ホテルの店は、計画上どのパークのエリアか添える） */
export const diningPlace = (r: Ride): string => (r.dining?.inPark === false ? `ホテル（${parkName(r.park)}エリア）` : parkName(r.park));

/** 図鑑のカードに出す説明の行 */
export function diningLines(r: Ride): AccessLine[] {
  const d = r.dining;
  if (!d) return [];
  const meals = d.meals.map((m) => MEAL_LABEL[m]).join("・");
  return [
    d.characters
      ? { label: "会えるキャラクター", value: d.characters, strong: true }
      : { label: "キャラクター", value: "出ない（ふつうのレストラン）" },
    { label: d.characters ? "キャラクターが出る食事" : "選べる食事", value: meals },
    ...(d.hours ? [{ label: "営業時間の目安", value: `${d.hours}（2026-10時点）` }] : []),
    { label: "予約", value: BOOKING_TEXT[d.booking](d.walkUp), strong: d.booking !== "none" },
    { label: "入園チケット", value: d.inPark ? "必要（パークの中の店）" : "不要（ホテルの中の店）" },
    { label: "場所", value: d.place },
    { label: "行き方", value: d.access },
    { label: "料理", value: d.cuisine ? `${d.cuisine}・${STYLE_LABEL[d.style]}` : STYLE_LABEL[d.style] },
    { label: "価格帯", value: PRICE_LABEL[d.price] },
  ];
}
