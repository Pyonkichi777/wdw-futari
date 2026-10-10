import type { CharacterDining, MealPeriod } from "../data/dining";
import { MEAL_LABEL, STYLE_LABEL } from "../data/dining";
import { PARKS } from "../data/parks";
import { normalize } from "./search";

/** ディズニーの食事予約は、直営ホテル宿泊者ならチェックイン日の60日前・朝6時（米東部時間）から滞在全日分（最大10日）を予約できる */
export const BOOKING_DAYS_BEFORE = 60;

/**
 * 予約開始の日時（日本時間で表示する文字列）。
 * checkIn は "YYYY-MM-DD"。米東部の夏時間かどうかは Intl に任せる
 */
export function bookingOpensJst(checkIn: string): string {
  const [y, m, d] = checkIn.split("-").map(Number) as [number, number, number];
  const day = new Date(Date.UTC(y, m - 1, d - BOOKING_DAYS_BEFORE));
  // その日の 6:00 米東部時間 = UTC 10:00（夏時間）か 11:00（標準時間）
  const probe = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12));
  const etHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(probe));
  const offset = 12 - etHour; // 4（夏時間）か 5（標準時間）
  const opens = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 6 + offset));
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(opens);
}

export type DiningArea = "ALL" | "park" | "resort";

export interface DiningFilter {
  area: DiningArea;
  meal: MealPeriod | "ALL";
  q: string;
}

const placeName = (d: CharacterDining): string => (d.area === "resort" ? "ホテル" : (PARKS.find((p) => p.id === d.area)?.nameJa ?? ""));

export function filterDining(list: readonly CharacterDining[], f: DiningFilter): CharacterDining[] {
  const words = f.q.split(/[\s　]+/).map(normalize).filter((w) => w !== "");
  return list.filter((d) => {
    if (f.area === "park" && d.area === "resort") return false;
    if (f.area === "resort" && d.area !== "resort") return false;
    if (f.meal !== "ALL" && !d.meals.includes(f.meal)) return false;
    if (words.length === 0) return true;
    const text = normalize([d.nameJa, d.nameEn, d.place, d.characters, d.description, placeName(d), STYLE_LABEL[d.style], ...d.meals.map((m) => MEAL_LABEL[m])].join(" "));
    return words.every((w) => text.includes(w));
  });
}
