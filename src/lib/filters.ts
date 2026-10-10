import { REVIEWS } from "../data/reviews";
import type { Ride } from "../types";
import { scoreOf } from "./reviewScore";

/** 絞り込みの条件（複数選んだら「すべて満たすもの」） */
export type FeatureId = "top10" | "single" | "tier1" | "early" | "review45" | "notTokyo" | "singleRider" | "gentle";

export const FEATURES: readonly { id: FeatureId; label: string; test: (r: Ride) => boolean }[] = [
  { id: "top10", label: "TOP10", test: (r) => r.top10 !== undefined },
  { id: "review45", label: "口コミ★4.5以上", test: (r) => (REVIEWS[r.id] ? (scoreOf(REVIEWS[r.id]!).rating ?? 0) >= 4.5 : false) },
  { id: "single", label: "Single Pass", test: (r) => r.lightningLane === "single" },
  { id: "tier1", label: "Multi Pass人気グループ", test: (r) => r.multiPassTier === 1 },
  { id: "early", label: "開園前入園OK", test: (r) => r.kind === "ride" && r.earlyEntry },
  { id: "notTokyo", label: "東京にない", test: (r) => !r.inTokyo },
  { id: "singleRider", label: "1人乗り専用の列", test: (r) => r.singleRider },
  { id: "gentle", label: "負担が弱い", test: (r) => r.intensity === "弱い" },
];

export function matchesFeatures(ride: Ride, selected: ReadonlySet<FeatureId>): boolean {
  return FEATURES.every((f) => !selected.has(f.id) || f.test(ride));
}

export function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
