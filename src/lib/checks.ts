import type { PersonId } from "../types";

/** 予約・購入の「済」チェック。キーは予約タスクのid */
export type Checks = Partial<Record<string, { by: PersonId; at: number }>>;

/** 保存データを読み直す（壊れた項目は捨てる） */
export function parseChecks(data: unknown): Checks {
  const out: Checks = {};
  if (typeof data !== "object" || data === null) return out;
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== "object" || v === null) continue;
    const { by, at } = v as Record<string, unknown>;
    if ((by === "toshi" || by === "tsuma") && typeof at === "number") out[k] = { by, at };
  }
  return out;
}
