import type { Consensus, ConsensusItem, PersonId, Rank, Ride, VoteLevel, Votes } from "../types";

/** S（何があっても乗る）の上限。全部Sにすると全部が中途半端になるため */
export const MAX_S = 6;

export const VOTE_LABELS: Record<VoteLevel, string> = {
  must: "絶対乗る",
  want: "乗りたい",
  either: "どちらでも",
  skip: "乗らない",
};

export const VOTE_ORDER: readonly VoteLevel[] = ["must", "want", "either", "skip"];

const SCORE: Record<VoteLevel, number> = { must: 3, want: 2, either: 1, skip: 0 };

export type AllVotes = Record<PersonId, Votes>;

export const emptyVotes = (): AllVotes => ({ toshi: {}, tsuma: {} });

export const answeredCount = (votes: Votes, rides: readonly Ride[]): number =>
  rides.filter((r) => votes[r.id] !== undefined).length;

export const isComplete = (votes: Votes, rides: readonly Ride[]): boolean =>
  answeredCount(votes, rides) === rides.length;

export interface Candidate {
  ride: Ride;
  toshi: VoteLevel;
  tsuma: VoteLevel;
  score: number;
  /** 片方が「乗らない」を選んだもの（1人で乗る作戦の対象） */
  soloOnly: boolean;
  suggested: Rank;
}

/**
 * 2人の投票から合意リストの候補を作る。
 * 2人とも「乗らない」は除外。並びは 合計点 → 「絶対」の人数 → TOP10順位 → 名前。
 * おすすめのランク: 2人とも「絶対」= S（上限 MAX_S。あふれた分はA）、片方が「絶対」= A、それ以外 = B。
 */
export function buildCandidates(rides: readonly Ride[], all: AllVotes): Candidate[] {
  const list = rides.flatMap((ride): Candidate[] => {
    const toshi = all.toshi[ride.id];
    const tsuma = all.tsuma[ride.id];
    if (toshi === undefined || tsuma === undefined) return [];
    if (toshi === "skip" && tsuma === "skip") return [];
    return [{ ride, toshi, tsuma, score: SCORE[toshi] + SCORE[tsuma], soloOnly: toshi === "skip" || tsuma === "skip", suggested: "B" }];
  });

  const mustCount = (c: Candidate): number => Number(c.toshi === "must") + Number(c.tsuma === "must");
  list.sort(
    (a, b) =>
      b.score - a.score ||
      mustCount(b) - mustCount(a) ||
      (a.ride.top10 ?? 99) - (b.ride.top10 ?? 99) ||
      a.ride.nameJa.localeCompare(b.ride.nameJa, "ja"),
  );

  let sUsed = 0;
  for (const c of list) {
    const musts = mustCount(c);
    if (musts === 2 && sUsed < MAX_S) {
      c.suggested = "S";
      sUsed += 1;
    } else if (musts >= 1) {
      c.suggested = "A";
    }
  }
  return list;
}

/** 候補のおすすめどおりに合意リストを作る */
export const suggestedConsensus = (candidates: readonly Candidate[]): ConsensusItem[] =>
  candidates.map((c) => ({ rideId: c.ride.id, rank: c.suggested }));

const RANK_ORDER: Record<Rank, number> = { S: 0, A: 1, B: 2 };

/** S → A → B の順に並べ直す（同じランク内の順番は保つ） */
export const sortByRank = (items: readonly ConsensusItem[]): ConsensusItem[] =>
  items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => RANK_ORDER[a.item.rank] - RANK_ORDER[b.item.rank] || a.i - b.i)
    .map(({ item }) => item);

export function setRank(items: readonly ConsensusItem[], rideId: string, rank: Rank): ConsensusItem[] {
  return sortByRank(items.map((it) => (it.rideId === rideId ? { ...it, rank } : it)));
}

/** 同じランクの中で1つ上（-1）・下（+1）に動かす。ランクをまたぐ移動はしない */
export function move(items: readonly ConsensusItem[], rideId: string, dir: -1 | 1): ConsensusItem[] {
  const i = items.findIndex((it) => it.rideId === rideId);
  const j = i + dir;
  const a = items[i];
  const b = items[j];
  if (a === undefined || b === undefined || a.rank !== b.rank) return [...items];
  const next = [...items];
  next[i] = b;
  next[j] = a;
  return next;
}

export const removeItem = (items: readonly ConsensusItem[], rideId: string): ConsensusItem[] =>
  items.filter((it) => it.rideId !== rideId);

export const countRank = (items: readonly ConsensusItem[], rank: Rank): number =>
  items.filter((it) => it.rank === rank).length;

export interface ConsensusWarning {
  kind: "too-many-s" | "no-s";
  message: string;
}

export function warnings(items: readonly ConsensusItem[]): ConsensusWarning[] {
  const s = countRank(items, "S");
  const out: ConsensusWarning[] = [];
  if (s > MAX_S) out.push({ kind: "too-many-s", message: `Sが${s}本あります。${MAX_S}本以内にしないと、全部が中途半端になります` });
  if (items.length > 0 && s === 0) out.push({ kind: "no-s", message: "Sが1本もありません。「何があっても乗る」ものを決めましょう" });
  return out;
}

export const emptyConsensus = (): Consensus => ({ items: [], confirmed: false, updatedBy: null, updatedAt: null });
