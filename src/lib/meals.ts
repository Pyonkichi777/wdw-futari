import type { MealPeriod, MealPrefs, PersonId, Ride } from "../types";

export type AllMeals = Record<PersonId, MealPrefs>;

export const emptyMeals = (): AllMeals => ({ toshi: {}, tsuma: {} });

export const MEAL_ORDER: readonly MealPeriod[] = ["breakfast", "lunch", "dinner"];

const isMeal = (v: unknown): v is MealPeriod => v === "breakfast" || v === "lunch" || v === "dinner";

/** 保存データを読み直す（知らない値は捨てる） */
export function parseMealPrefs(data: unknown): MealPrefs {
  const out: MealPrefs = {};
  if (typeof data !== "object" || data === null) return out;
  for (const [k, v] of Object.entries(data)) {
    if (!Array.isArray(v)) continue;
    const meals = MEAL_ORDER.filter((m) => v.some((x) => isMeal(x) && x === m));
    if (meals.length > 0) out[k] = meals;
  }
  return out;
}

/** 希望の時間帯を1つ付けたり外したりする（並びは朝→昼→夜にそろえる） */
export function toggleMeal(current: readonly MealPeriod[] | undefined, meal: MealPeriod): MealPeriod[] {
  const set = new Set(current ?? []);
  if (set.has(meal)) set.delete(meal);
  else set.add(meal);
  return MEAL_ORDER.filter((m) => set.has(m));
}

export interface MealSuggestion {
  meal: MealPeriod;
  /** なぜその時間帯にしたか */
  reason: "both" | "one" | "only" | "none";
}

/**
 * 2人の希望から、合意リストでのおすすめの時間帯を決める。
 * 1. 店がその時間帯しかやっていない → それ
 * 2. 2人とも希望している時間帯 → その中で早いもの
 * 3. どちらかが希望している時間帯 → その中で早いもの
 * 4. 希望なし → 店の最初の時間帯
 */
export function suggestMeal(ride: Ride, all: AllMeals): MealSuggestion | null {
  const available = ride.dining?.meals ?? [];
  const first = available[0];
  if (first === undefined) return null;
  if (available.length === 1) return { meal: first, reason: "only" };
  const a = (all.toshi[ride.id] ?? []).filter((m) => available.includes(m));
  const b = (all.tsuma[ride.id] ?? []).filter((m) => available.includes(m));
  const both = a.find((m) => b.includes(m));
  if (both) return { meal: both, reason: "both" };
  const one = MEAL_ORDER.find((m) => a.includes(m) || b.includes(m));
  if (one) return { meal: one, reason: "one" };
  return { meal: first, reason: "none" };
}
