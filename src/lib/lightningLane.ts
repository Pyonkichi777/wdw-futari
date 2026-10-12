import type { Ride } from "../types";

/** 時短パス（Lightning Lane）の対象を公式サイトで最後に確認した日 */
export const LL_VERIFIED_AT = "2026-10-12";

export type LlKind = "singleOnly" | "multiTier1" | "multi" | "none";

/** 乗り物ごとの時短パスの区分 */
export function llKind(r: Ride): LlKind {
  if (r.lightningLane === "single") return "singleOnly";
  if (r.lightningLane === "multi") return r.multiPassTier === 1 && r.park !== "AK" ? "multiTier1" : "multi";
  return "none";
}

export const LL_SHORT: Record<LlKind, string> = {
  singleOnly: "Single Pass専用",
  multiTier1: "Multi Pass可（人気グループ）",
  multi: "Multi Pass可",
  none: "時短パスなし",
};

export const LL_LONG: Record<LlKind, string> = {
  singleOnly: "Single Pass専用（1本ずつ有料で買う。Multi Passでは乗れない）",
  multiTier1: "Multi Passで乗れる（人気グループ：事前予約は1日1本まで）",
  multi: "Multi Passで乗れる",
  none: "時短パスなし（並ぶだけ）",
};
