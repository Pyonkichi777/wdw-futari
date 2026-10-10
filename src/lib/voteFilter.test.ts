import { describe, expect, it } from "vitest";
import { RIDES } from "../data/rides";
import type { Votes } from "../types";
import { countByStatus, matchesVoteStatus, statusOf, type VoteStatus } from "./voteFilter";

const [a, b, c] = RIDES;
const votes: Votes = { [a!.id]: "must", [b!.id]: "skip" };
const pick = (...s: VoteStatus[]): string[] => RIDES.filter((r) => matchesVoteStatus(votes, r.id, new Set(s))).map((r) => r.id);

describe("自分の回答で絞り込む", () => {
  it("答えていないものは none", () => {
    expect(statusOf(votes, a!.id)).toBe("must");
    expect(statusOf(votes, c!.id)).toBe("none");
  });

  it("何も選ばなければ全件", () => {
    expect(pick()).toHaveLength(RIDES.length);
  });

  it("1つ選ぶとその回答だけ、未回答も選べる", () => {
    expect(pick("must")).toEqual([a!.id]);
    expect(pick("none")).toHaveLength(RIDES.length - 2);
  });

  it("複数選ぶと、どれかに当てはまるもの", () => {
    expect(pick("must", "skip").sort()).toEqual([a!.id, b!.id].sort());
  });

  it("件数の合計は全件と一致する", () => {
    const n = countByStatus(votes, RIDES);
    expect(n.must).toBe(1);
    expect(n.skip).toBe(1);
    expect(n.want + n.either).toBe(0);
    expect(n.none).toBe(RIDES.length - 2);
  });
});
