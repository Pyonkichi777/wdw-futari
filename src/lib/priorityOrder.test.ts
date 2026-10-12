import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { rideById } from "../data/rides";
import { TRIP } from "../data/trip";
import type { ConsensusItem } from "../types";
import { parseCrowdFeed } from "./crowd";
import { chooseParkOrder, parkOrderFor } from "./plan";
import { isVetoed } from "./priority";

// MKに乗り物が多い（重い）合意リスト。以前は重さが優先順位に勝ち、第1優先のアニマルキングダムが空いている日を取れなかった
const heavyMk: ConsensusItem[] = [
  ...["tron", "seven-dwarfs", "space-mountain", "big-thunder", "pirates", "haunted-mansion", "peter-pan", "jungle-cruise", "tiana"].map((rideId) => ({ rideId, rank: "S" as const })),
  { rideId: "flight-of-passage", rank: "A" },
];
const order = ["AK", "MK", "HS", "EP"] as const;
const dayOf = (o: readonly string[], park: string) => TRIP.parkDays[o.indexOf(park)];

describe("本命パークの優先順位どおりに、空いている日を取る", () => {
  it("一般的な傾向（推定）: 第1優先のアニマルキングダムは、4日のうちいちばん空く 5/4(火)", () => {
    const o = parkOrderFor(heavyMk, rideById, TRIP.parkDays, { focusParks: [...order] });
    expect(dayOf(o, "AK")).toBe("2027-05-04");
    expect(dayOf(o, "HS")).not.toBe("2027-05-04");
  });
  it("Magic Tips の予想: 第1優先 AK→5/4、第2優先 MK→残りでいちばん空く 5/2、第3優先 HS→5/3", () => {
    const feed = parseCrowdFeed(JSON.parse(readFileSync("public/crowd.json", "utf-8")));
    const o = parkOrderFor(heavyMk, rideById, TRIP.parkDays, { focusParks: [...order], crowd: feed });
    expect([dayOf(o, "AK"), dayOf(o, "MK"), dayOf(o, "HS"), dayOf(o, "EP")]).toEqual(["2027-05-04", "2027-05-02", "2027-05-03", "2027-05-01"]);
  });
  it("優先順位がなければ、従来どおり全体の負担で決める", () => {
    expect(chooseParkOrder([], TRIP.parkDays)).toHaveLength(4);
  });
});

describe("どちらか1人でも「乗らない」は作戦に入れない", () => {
  it("1人が乗らない → 入れない、2人とも乗る系 → 入れる", () => {
    const votes = { toshi: { a: "either", b: "must" }, tsuma: { a: "skip", b: "want" } } as const;
    expect(isVetoed(votes, "a")).toBe(true);
    expect(isVetoed(votes, "b")).toBe(false);
  });
});

describe("「この日はこのパーク」を手で決める（📌）", async () => {
  const { buildPlan, parsePlan } = await import("./plan");
  const { reservationTasks } = await import("./reservations");
  it("決めた日はそのパーク、残りの日は優先順位と混雑で自動。乗り物・予約もそれに合わせて変わる", () => {
    const p = buildPlan(heavyMk, rideById, TRIP.parkDays, { focusParks: [...order], fixedParks: { "2027-05-01": "AK", "2027-05-05": "HS" } });
    expect(p.days[0]?.morningPark).toBe("AK");
    expect(p.days[4]?.morningPark).toBe("HS");
    expect(new Set(p.days.slice(0, 4).map((d) => d.morningPark))).toEqual(new Set(["AK", "MK", "HS", "EP"]));
    expect(p.days[0]?.items.some((i) => i.rideId === "flight-of-passage")).toBe(true);
    const ak = reservationTasks(p, rideById).filter((t) => t.rideIds.includes("flight-of-passage"));
    expect(ak.every((t) => t.id.includes("2027-05-01"))).toBe(true);
    expect(parsePlan(JSON.parse(JSON.stringify(p))).fixedParks).toEqual({ "2027-05-01": "AK", "2027-05-05": "HS" });
  });
  it("同じパークを2日にしてもよい（その分、行かないパークが出る）", () => {
    const p = buildPlan(heavyMk, rideById, TRIP.parkDays, { fixedParks: { "2027-05-01": "MK", "2027-05-02": "MK" } });
    expect(p.days.slice(0, 2).map((d) => d.morningPark)).toEqual(["MK", "MK"]);
  });
});
