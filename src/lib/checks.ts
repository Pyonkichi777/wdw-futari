import type { PersonId } from "../types";
import type { FixedTime } from "./bookTimes";

/** 旧データ・食事は単一時刻、パスは実際に取れた到着枠。終了を推測しない */
export type GotTime = string | { from: string; to: string };
export const isClock = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const isGotTime = (value: unknown): value is GotTime => {
  if (isClock(value)) return true;
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return isClock(v.from) && isClock(v.to) && v.from < v.to;
};
export const gotTimeText = (value: GotTime): string => typeof value === "string" ? value : `${value.from}〜${value.to}（到着枠）`;
export const isChecked = (value: Checks[string]): boolean => value !== undefined && value.done !== false;

/** 予約・購入の「済」チェック。キーは予約タスクのid */
export type Checks = Partial<Record<string, { by: PersonId; at: number; done?: boolean; got?: Record<string, GotTime> }>>;

/** 保存データを読み直す（壊れた項目は捨てる） */
export function parseChecks(data: unknown): Checks {
  const out: Checks = {};
  if (typeof data !== "object" || data === null) return out;
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== "object" || v === null) continue;
    const { by, at, got, done } = v as Record<string, unknown>;
    if (!((by === "toshi" || by === "tsuma") && typeof at === "number")) continue;
    // 取れた予約の時刻（rideId → "HH:MM"）
    const times: Record<string, GotTime> = {};
    if (typeof got === "object" && got !== null) for (const [rid, hm] of Object.entries(got)) if (isGotTime(hm)) times[rid] = hm;
    out[k] = { by, at, ...(done === false ? { done: false } : {}), ...(Object.keys(times).length > 0 ? { got: times } : {}) };
  }
  return out;
}

/** その日の「取れた予約の時刻」（rideId → 分）。予約タスクのidは「種類:日付:…」 */
export function fixedTimesFor(checks: Checks, date: string): Map<string, FixedTime> {
  const out = new Map<string, number | { from: number; to: number }>();
  const minutes = (hm: string): number => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
  for (const [id, v] of Object.entries(checks)) {
    if (!isChecked(v) || !v?.got || id.split(":")[1] !== date) continue;
    for (const [rid, hm] of Object.entries(v.got)) if (isGotTime(hm)) out.set(rid, typeof hm === "string" ? minutes(hm) : { from: minutes(hm.from), to: minutes(hm.to) });
  }
  return out;
}
