import { COORDS } from "../data/coords";
import { distanceKm } from "./location";
import { SLOT_ORDER, type DayPlan, type PlanItem } from "./plan";

const pos = (id: string): { lat: number; lng: number } | null => {
  const c = COORDS[id];
  return c ? { lat: c[0], lng: c[1] } : null;
};

/**
 * 1日の順番を「近い順」に並べ直す。時間の枠（朝イチ→午前→昼→午後→夕食→夜）は崩さず、
 * 枠の中だけを、直前にいた場所からいちばん近いものを次に選ぶ方法で並べる（歩く距離を減らす）。
 */
export function orderByRoute(items: readonly PlanItem[]): PlanItem[] {
  const out: PlanItem[] = [];
  let here: { lat: number; lng: number } | null = null;
  for (const slot of SLOT_ORDER) {
    const rest = items.filter((i) => i.slot === slot);
    while (rest.length > 0) {
      let best = 0;
      if (here) {
        let bestKm = Infinity;
        rest.forEach((it, i) => {
          const p = pos(it.rideId);
          const km = p && here ? distanceKm(here, p) : Infinity;
          if (km < bestKm) {
            bestKm = km;
            best = i;
          }
        });
      }
      const [next] = rest.splice(best, 1);
      if (!next) break;
      out.push(next);
      here = pos(next.rideId) ?? here;
    }
  }
  return out;
}

/**
 * 1日を近い順に組み直す。午前・午後の乗り物やグリーティング（時刻の決まったショーと食事は除く）は
 * いったん1本の道順にまとめ、前半を午前・後半を午後に振り分け直す（行ったり来たりを減らす）
 */
export function routeDay(d: DayPlan): DayPlan {
  const movable = (i: PlanItem): boolean => (i.slot === "am" || i.slot === "pm") && i.method !== "show" && i.method !== "meal";
  const flex = d.items.filter(movable);
  if (flex.length > 1) {
    const early = d.items.filter((i) => i.slot === "early");
    // 朝イチの場所から、近い順にたどる
    const path = orderByRoute([...early, ...flex.map((i) => ({ ...i, slot: "am" as const }))]).filter((i) => i.slot === "am" && !early.includes(i));
    const half = Math.ceil(path.length / 2);
    const reassigned = path.map((i, idx) => ({ ...i, slot: idx < half ? ("am" as const) : ("pm" as const) }));
    return { ...d, items: orderByRoute([...d.items.filter((i) => !movable(i)), ...reassigned]) };
  }
  return { ...d, items: orderByRoute(d.items) };
}

/** 1日に歩く距離のおおよそ（km、パーク間の移動は除く） */
export function walkKm(items: readonly PlanItem[], parkOf: (id: string) => string | undefined): number {
  let total = 0;
  let prev: { lat: number; lng: number; park: string | undefined } | null = null;
  for (const it of items) {
    const p = pos(it.rideId);
    if (!p) continue;
    const park = parkOf(it.rideId);
    if (prev && prev.park === park) total += distanceKm(prev, p) * 1.4; // 道は直線より長い
    prev = { ...p, park };
  }
  return total;
}
