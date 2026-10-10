import { describe, expect, it } from "vitest";
import { RIDES } from "../data/rides";
import type { Ride, VoteLevel, Votes } from "../types";
import {
  MAX_S,
  answeredCount,
  buildCandidates,
  isComplete,
  move,
  removeItem,
  setRank,
  suggestedConsensus,
  warnings,
  type AllVotes,
} from "./consensus";

const ride = (id: string, top10?: number): Ride => ({
  id,
  nameJa: id,
  nameEn: id,
  park: "MK",
  minHeightCm: null,
  intensity: "弱い",
  tags: [],
  lightningLane: "multi",
  officialPath: `/attractions/magic-kingdom/${id}/`,
  kind: "ride",
  earlyEntry: false,
  singleRider: false,
  inTokyo: false,
  description: "",
  top10,
});

const votes = (pairs: Record<string, [VoteLevel, VoteLevel]>): AllVotes => {
  const toshi: Votes = {};
  const tsuma: Votes = {};
  for (const [id, [a, b]] of Object.entries(pairs)) {
    toshi[id] = a;
    tsuma[id] = b;
  }
  return { toshi, tsuma };
};

describe("投票の進み具合", () => {
  it("答えた数と、全部答えたかを数える", () => {
    const rides = [ride("a"), ride("b")];
    expect(answeredCount({ a: "must" }, rides)).toBe(1);
    expect(isComplete({ a: "must" }, rides)).toBe(false);
    expect(isComplete({ a: "must", b: "skip" }, rides)).toBe(true);
  });
});

describe("合意リストの候補", () => {
  it("2人とも「乗らない」は除外し、合計点の高い順に並べる", () => {
    const rides = [ride("a"), ride("b"), ride("c")];
    const c = buildCandidates(rides, votes({ a: ["want", "either"], b: ["must", "must"], c: ["skip", "skip"] }));
    expect(c.map((x) => x.ride.id)).toEqual(["b", "a"]);
  });

  it("同点なら「絶対」の人数、次にTOP10の順位で並べる", () => {
    const rides = [ride("x"), ride("y", 5), ride("z", 2)];
    // x: must+either=4（絶対1人）、y: want+want=4（絶対0人）、z: want+want=4（絶対0人・TOP2）
    const c = buildCandidates(rides, votes({ x: ["must", "either"], y: ["want", "want"], z: ["want", "want"] }));
    expect(c.map((r) => r.ride.id)).toEqual(["x", "z", "y"]);
  });

  it("おすすめ: 2人とも絶対=S、片方が絶対=A、それ以外=B。片方が乗らないものに印をつける", () => {
    const rides = [ride("s"), ride("a"), ride("b")];
    const c = buildCandidates(rides, votes({ s: ["must", "must"], a: ["must", "skip"], b: ["want", "want"] }));
    const byId = Object.fromEntries(c.map((x) => [x.ride.id, x]));
    expect(byId.s?.suggested).toBe("S");
    expect(byId.a?.suggested).toBe("A");
    expect(byId.a?.soloOnly).toBe(true);
    expect(byId.b?.suggested).toBe("B");
  });

  it(`Sのおすすめは${MAX_S}本まで。あふれた分はAになる`, () => {
    const rides = Array.from({ length: MAX_S + 2 }, (_, i) => ride(`r${i}`));
    const all = votes(Object.fromEntries(rides.map((r) => [r.id, ["must", "must"] as [VoteLevel, VoteLevel]])));
    const items = suggestedConsensus(buildCandidates(rides, all));
    expect(items.filter((i) => i.rank === "S")).toHaveLength(MAX_S);
    expect(items.filter((i) => i.rank === "A")).toHaveLength(2);
  });
});

describe("合意リストの操作", () => {
  const base = [
    { rideId: "a", rank: "S" as const },
    { rideId: "b", rank: "S" as const },
    { rideId: "c", rank: "A" as const },
  ];

  it("ランクを変えると S→A→B の順に並び直す", () => {
    expect(setRank(base, "c", "S").map((i) => i.rideId)).toEqual(["a", "b", "c"]);
    expect(setRank(base, "a", "B").map((i) => i.rideId)).toEqual(["b", "c", "a"]);
  });

  it("同じランクの中でだけ上下に動かせる", () => {
    expect(move(base, "b", -1).map((i) => i.rideId)).toEqual(["b", "a", "c"]);
    expect(move(base, "b", 1).map((i) => i.rideId)).toEqual(["a", "b", "c"]); // 下はAなので動かない
    expect(move(base, "a", -1).map((i) => i.rideId)).toEqual(["a", "b", "c"]); // 先頭
  });

  it("外せる", () => {
    expect(removeItem(base, "a").map((i) => i.rideId)).toEqual(["b", "c"]);
  });

  it("Sが多すぎる・1本もないときは警告する", () => {
    const many = Array.from({ length: MAX_S + 1 }, (_, i) => ({ rideId: `r${i}`, rank: "S" as const }));
    expect(warnings(many).map((w) => w.kind)).toEqual(["too-many-s"]);
    expect(warnings([{ rideId: "a", rank: "A" }]).map((w) => w.kind)).toEqual(["no-s"]);
    expect(warnings(base)).toEqual([]);
    expect(warnings([])).toEqual([]);
  });
});

describe("アトラクションデータ", () => {
  it("IDが重複していない", () => {
    expect(new Set(RIDES.map((r) => r.id)).size).toBe(RIDES.length);
  });

  it("TOP10が1〜10まで1つずつある", () => {
    const ranks = RIDES.flatMap((r) => (r.top10 === undefined ? [] : [r.top10])).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
