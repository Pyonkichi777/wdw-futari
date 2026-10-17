import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import type { Plan } from "./plan";
import { planToText } from "./planText";

describe("I08: 作戦を文字で控える", () => {
  const plan: Plan = {
    updatedBy: null,
    updatedAt: null,
    days: [
      { date: "2027-05-04", morningPark: "AK", eveningPark: "AK", items: [{ rideId: "flight-of-passage", slot: "early", method: "early" }, { rideId: "dine-tusker-house", slot: "lunch", method: "meal" }] },
      { date: "2027-05-05", morningPark: "MK", eveningPark: "MK", items: [] },
    ],
  };
  it("日ごとの予定・時刻・取れた予約・予約の状況が入る", () => {
    const t = planToText(plan, { "dine:2027-05-04:dine-tusker-house": { by: "toshi", at: 1, got: { "dine-tusker-house": "11:45" } } }, rideById, null, new Date("2026-10-18T03:00:00Z"));
    expect(t).toContain("■ 5/4(火) アニマルキングダム");
    expect(t).toContain("11:45（取れた予約）");
    expect(t).toContain("（予定なし）");
    expect(t).toContain("✓ 取得済み");
    expect(t).toContain("控えた日時");
  });
});
