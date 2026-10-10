import { PARKS } from "../data/parks";
import type { ParkId, Ride, RideKind, Votes } from "../types";
import { FEATURES, matchesFeatures, type FeatureId } from "./filters";
import { VOTE_STATUSES, matchesVoteStatus, type VoteStatus } from "./voteFilter";

const KIND_IDS: readonly RideKind[] = ["ride", "show", "parade", "night", "walk"];

/** 図鑑・投票の絞り込み条件。タブを移ってもアプリを閉じても残す */
export interface ListFilters {
  park: ParkId | "ALL";
  kind: RideKind | "ALL";
  features: FeatureId[];
  statuses: VoteStatus[];
}

export const EMPTY_FILTERS: ListFilters = { park: "ALL", kind: "ALL", features: [], statuses: [] };

export const isFiltered = (f: ListFilters): boolean => f.park !== "ALL" || f.kind !== "ALL" || f.features.length > 0 || f.statuses.length > 0;

const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): v is T => typeof v === "string" && (allowed as readonly string[]).includes(v);

const listOf = <T extends string>(v: unknown, allowed: readonly T[]): T[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => oneOf(x, allowed)))] : []);

/** 保存してあった値を読み直す。壊れていたり古い形式だったりした項目は「絞り込みなし」に戻す */
export function parseFilters(raw: unknown): ListFilters {
  if (typeof raw !== "object" || raw === null) return EMPTY_FILTERS;
  const r = raw as Record<string, unknown>;
  return {
    park: oneOf(r.park, PARKS.map((p) => p.id)) ? r.park : "ALL",
    kind: oneOf(r.kind, KIND_IDS) ? r.kind : "ALL",
    features: listOf(r.features, FEATURES.map((f) => f.id)),
    statuses: listOf(r.statuses, VOTE_STATUSES),
  };
}

/**
 * 条件で絞り込む。base = 回答以外の条件だけ（回答ごとの件数を数えるのに使う）、rides = 表示するもの。
 * keepId（図鑑⇔投票のリンクで飛んできたアトラクション）は、条件に合わなくても必ず表示する
 */
export function applyFilters(all: readonly Ride[], f: ListFilters, votes: Votes, keepId?: string): { base: Ride[]; rides: Ride[] } {
  const features = new Set(f.features);
  const statuses = new Set(f.statuses);
  const base = all.filter((r) => (f.park === "ALL" || r.park === f.park) && (f.kind === "ALL" || r.kind === f.kind) && matchesFeatures(r, features));
  const shown = new Set(base.filter((r) => matchesVoteStatus(votes, r.id, statuses)).map((r) => r.id));
  if (keepId) shown.add(keepId);
  return { base, rides: all.filter((r) => shown.has(r.id)) };
}
