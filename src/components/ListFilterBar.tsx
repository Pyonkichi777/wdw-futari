import { countByStatus } from "../lib/voteFilter";
import { EMPTY_FILTERS, isFiltered, type ListFilters } from "../lib/listFilters";
import type { Ride, Votes } from "../types";
import { FeatureFilter } from "./FeatureFilter";
import { KindFilter } from "./KindFilter";
import { ParkFilter } from "./ParkFilter";
import { VoteStatusFilter } from "./VoteStatusFilter";

interface Props {
  filters: ListFilters;
  onChange: (patch: Partial<ListFilters>) => void;
  /** 回答ごとの件数を数える範囲（回答以外の条件で絞ったもの） */
  base: readonly Ride[];
  myVotes: Votes;
}

/** 図鑑・投票で共通の絞り込み（パーク・種類・条件・あなたの回答） */
export function ListFilterBar({ filters, onChange, base, myVotes }: Props) {
  return (
    <>
      <ParkFilter value={filters.park} onChange={(park) => onChange({ park })} />
      <KindFilter value={filters.kind} onChange={(kind) => onChange({ kind })} />
      <FeatureFilter value={new Set(filters.features)} onChange={(s) => onChange({ features: [...s] })} />
      <VoteStatusFilter value={new Set(filters.statuses)} onChange={(s) => onChange({ statuses: [...s] })} counts={countByStatus(myVotes, base)} />
      {isFiltered(filters) && (
        <button className="chip clear all-clear" onClick={() => onChange(EMPTY_FILTERS)}>
          絞り込みをすべて解除
        </button>
      )}
    </>
  );
}
