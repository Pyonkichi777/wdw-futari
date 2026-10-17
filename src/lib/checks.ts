import type { PersonId } from "../types";

/** 予約・購入の「済」チェック。キーは予約タスクのid */
export type Checks = Partial<Record<string, { by: PersonId; at: number; got?: Record<string, string> }>>;

/** 保存データを読み直す（壊れた項目は捨てる） */
export function parseChecks(data: unknown): Checks {
  const out: Checks = {};
  if (typeof data !== "object" || data === null) return out;
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== "object" || v === null) continue;
    const { by, at, got } = v as Record<string, unknown>;
    if (!((by === "toshi" || by === "tsuma") && typeof at === "number")) continue;
    // 取れた予約の時刻（rideId → "HH:MM"）
    const times: Record<string, string> = {};
    if (typeof got === "object" && got !== null) for (const [rid, hm] of Object.entries(got)) if (typeof hm === "string" && /^\d{2}:\d{2}$/.test(hm)) times[rid] = hm;
    out[k] = Object.keys(times).length > 0 ? { by, at, got: times } : { by, at };
  }
  return out;
}

/** その日の「取れた予約の時刻」（rideId → 分）。予約タスクのidは「種類:日付:…」 */
export function fixedTimesFor(checks: Checks, date: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, v] of Object.entries(checks)) {
    if (!v?.got || id.split(":")[1] !== date) continue;
    for (const [rid, hm] of Object.entries(v.got)) out.set(rid, Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)));
  }
  return out;
}
