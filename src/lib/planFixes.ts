import { parkName } from "../data/parks";
import { ITINERARY, TRIP } from "../data/trip";
import type { ConsensusItem, MealPeriod, ParkId, PersonId, Rank, Ride } from "../types";
import { METHOD_LABEL, SLOT_LABEL, moveItem, removeItems, setDayParks, type DayPlan, type ExcludedItem, type Method, type Plan, type Slot } from "./plan";

/** 警告を直すための提案（ボタンひとつで当てられる） */
export type Fix =
  | { kind: "move"; rideId: string; date: string; slot: Slot; method: Method; text: string }
  | { kind: "setParks"; date: string; morningPark: ParkId; eveningPark: ParkId; text: string; then?: { rideId: string; slot: Slot; method: Method } };

export function applyFix(plan: Plan, fix: Fix): Plan {
  if (fix.kind === "move") return moveItem(plan, fix.rideId, { date: fix.date, slot: fix.slot, method: fix.method });
  const next = setDayParks(plan, fix.date, { morningPark: fix.morningPark, eveningPark: fix.eveningPark });
  return fix.then ? moveItem(next, fix.then.rideId, { date: fix.date, slot: fix.then.slot, method: fix.then.method }) : next;
}

const labels = ITINERARY.filter((d) => d.park).map((d) => d.date);
export const dayName = (iso: string): string => labels[TRIP.parkDays.indexOf(iso as (typeof TRIP.parkDays)[number])] ?? iso;

export const MEAL_SLOT: Record<MealPeriod, Slot> = { breakfast: "am", lunch: "lunch", dinner: "dinner" };
export const mealOfSlot = (slot: Slot): MealPeriod => (slot === "dinner" || slot === "night" ? "dinner" : slot === "lunch" || slot === "pm" ? "lunch" : "breakfast");
const MEAL_JA: Record<MealPeriod, string> = { breakfast: "朝食", lunch: "昼食", dinner: "夕食" };

/** その時間の枠に、そのパークにいる日か */
const parkAt = (d: DayPlan, slot: Slot, park: ParkId): boolean =>
  slot === "dinner" || slot === "night" ? d.eveningPark === park : slot === "pm" ? d.morningPark === park || d.eveningPark === park : d.morningPark === park;

/** その日に入れるときの、いちばんよい乗り方（その日の時短パスの枠の空き具合を見る） */
export function bestMethod(r: Ride, d: DayPlan | undefined, rideById: (id: string) => Ride | undefined, exclude?: string): Method {
  if (r.kind === "dining") return "meal";
  if (r.kind === "show" || r.kind === "parade" || r.kind === "night") return "show";
  if (r.kind !== "ride") return "standby";
  const items = (d?.items ?? []).filter((i) => i.rideId !== exclude);
  if (r.lightningLane === "single") return items.filter((i) => i.method === "single").length < 2 ? "single" : "standby";
  if (r.lightningLane === "multi") {
    const pre = items.filter((i) => i.method === "multi");
    const tier1 = (x: Ride | undefined): boolean => x?.multiPassTier === 1 && x.park !== "AK";
    const tierOk = !tier1(r) || !pre.some((i) => tier1(rideById(i.rideId)));
    if (pre.length < 3 && tierOk) return "multi";
    return r.singleRider ? "singleRider" : "multiExtra";
  }
  return r.singleRider ? "singleRider" : "standby";
}

const load = (d: DayPlan): number => d.items.length;

/**
 * そのアトラクション（レストラン）を入れるのにいちばんよい日と時間を探す。
 * 乗り物: 朝のパークが同じで、予定の少ない日の午前。レストラン: その時間帯にそのパークにいて、その食事がまだ空いている日
 */
export function suggestPlace(plan: Plan, r: Ride, rideById: (id: string) => Ride | undefined, opts: { meal?: MealPeriod; avoidDate?: string } = {}): Fix | null {
  if (r.dining) {
    const meals = opts.meal && r.dining.meals.includes(opts.meal) ? [opts.meal, ...r.dining.meals.filter((m) => m !== opts.meal)] : [...r.dining.meals];
    for (const meal of meals) {
      const slot = MEAL_SLOT[meal];
      const day = [...plan.days]
        .filter((d) => d.date !== opts.avoidDate && parkAt(d, slot, r.park) && !d.items.some((i) => i.method === "meal" && i.slot === slot && i.rideId !== r.id))
        .sort((a, b) => load(a) - load(b))[0];
      if (day) return { kind: "move", rideId: r.id, date: day.date, slot, method: "meal", text: `${dayName(day.date)}（${parkName(r.park)}）の${MEAL_JA[meal]}に移す` };
    }
    // 合う日がなければ、夕食ならその日の夕方からのパークを変える提案
    const meal = meals[0];
    const target = plan.days.find((d) => d.date === opts.avoidDate) ?? plan.days[0];
    if (meal === "dinner" && target) {
      return { kind: "setParks", date: target.date, morningPark: target.morningPark, eveningPark: r.park, text: `${dayName(target.date)}の「夕方から」のパークを${parkName(r.park)}に変えて夕食に入れる（ホッパーで移動）`, then: { rideId: r.id, slot: "dinner", method: "meal" } };
    }
    return null;
  }
  const slot: Slot = r.kind === "night" ? "night" : r.kind === "show" || r.kind === "parade" ? "pm" : "am";
  const day = [...plan.days].filter((d) => d.date !== opts.avoidDate && parkAt(d, slot, r.park)).sort((a, b) => load(a) - load(b))[0];
  if (day) {
    const method = bestMethod(r, day, rideById, r.id);
    return { kind: "move", rideId: r.id, date: day.date, slot, method, text: `${dayName(day.date)}（${parkName(r.park)}）の${SLOT_LABEL[slot]}に移す（${METHOD_LABEL[method]}）` };
  }
  // そのパークの日がない → 予備日（最後の日）の朝のパークをそのパークにする
  const reserve = plan.days[plan.days.length - 1];
  if (reserve) {
    return { kind: "setParks", date: reserve.date, morningPark: r.park, eveningPark: r.park, text: `予備日の${dayName(reserve.date)}を${parkName(r.park)}の日にして、${SLOT_LABEL[slot]}に入れる`, then: { rideId: r.id, slot, method: bestMethod(r, reserve, rideById, r.id) } };
  }
  return null;
}

/** 同じ日の中で乗り方だけ直す提案 */
export function fixMethod(d: DayPlan, r: Ride, slot: Slot, method: Method, why: string): Fix {
  return { kind: "move", rideId: r.id, date: d.date, slot, method, text: `「${r.nameJa}」を${METHOD_LABEL[method]}に変える（${why}）` };
}

export const RANK_ORDER: Record<Rank, number> = { S: 0, A: 1, B: 2 };


/**
 * 「2人ともどちらでも」を全部外す。日に入っているものに加え、どの日にも入っていないものも「外したもの」に記録し、
 * dropLow を立てる（以後、作り直しても入れない。自分たちで元に戻したもの keptLow は除く）
 */
export function excludeAllLow(plan: Plan, consensus: readonly ConsensusItem[], isLow: (id: string) => boolean, rideById: (id: string) => Ride | undefined, by: PersonId | null): Plan {
  const kept = new Set(plan.keptLow ?? []);
  const low = new Set(consensus.map((c) => c.rideId).filter((id) => isLow(id) && !kept.has(id)));
  const removed = removeItems(plan, low, undefined, by);
  const already = new Set((removed.excluded ?? []).map((e) => e.rideId));
  const at = Date.now();
  const extra: ExcludedItem[] = consensus.flatMap((c): ExcludedItem[] => {
    const r = rideById(c.rideId);
    if (!r || !low.has(c.rideId) || already.has(c.rideId)) return [];
    const slot: Slot = r.dining ? MEAL_SLOT[c.meal ?? r.dining.meals[0] ?? "lunch"] : r.kind === "night" ? "night" : "pm";
    return [{ rideId: c.rideId, date: "", slot, method: bestMethod(r, undefined, rideById), by, at }];
  });
  return { ...removed, ...(extra.length > 0 || removed.excluded ? { excluded: [...(removed.excluded ?? []), ...extra] } : {}), dropLow: true };
}
