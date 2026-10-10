import type { Ride, VoteLevel, Votes } from "../types";
import { VOTE_ORDER } from "./consensus";

/** 自分の回答の状態。"none" = まだ答えていない */
export type VoteStatus = VoteLevel | "none";

export const VOTE_STATUSES: readonly VoteStatus[] = [...VOTE_ORDER, "none"];

export const statusOf = (votes: Votes, rideId: string): VoteStatus => votes[rideId] ?? "none";

/** 何も選ばなければ全部。複数選んだら「どれかに当てはまるもの」 */
export function matchesVoteStatus(votes: Votes, rideId: string, selected: ReadonlySet<VoteStatus>): boolean {
  return selected.size === 0 || selected.has(statusOf(votes, rideId));
}

/** 回答の状態ごとの件数 */
export function countByStatus(votes: Votes, rides: readonly Ride[]): Record<VoteStatus, number> {
  const counts: Record<VoteStatus, number> = { must: 0, want: 0, either: 0, skip: 0, none: 0 };
  for (const r of rides) counts[statusOf(votes, r.id)] += 1;
  return counts;
}
