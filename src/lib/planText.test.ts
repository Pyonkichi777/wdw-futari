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
    expect(t).toContain("■ 5/4(火) アニマル");
    expect(t).toContain("11:45（取れた予約）");
    expect(t).toContain("（予定なし）");
    expect(t).toContain("✓ 取得済み");
    expect(t).toContain("控えた日時");
  });
  it("T02: 控えは版・日時・取得枠・仮置きを含む固定文字列で、後の変更に影響されない", () => {
    const p: Plan = { ...plan, days: [{ date: "2027-05-05", morningPark: "AK", eveningPark: "MK", items: [{ rideId: "tron", slot: "dinner", method: "single" }, { rideId: "happily-ever-after", slot: "night", method: "show" }] }] };
    const text = planToText(p, { "sp:2027-05-05:tron": { by: "toshi", at: 1, got: { tron: { from: "18:10", to: "18:55" } } } }, rideById, null, new Date("2026-10-25T00:00:00Z"));
    expect(text).toContain("アプリ版:");
    expect(text).toContain("控えた日時:");
    expect(text).toContain("夕 マジック");
    expect(text).not.toContain("アニマル");
    expect(text).toContain("18:10〜18:55");
    expect(text).toContain("仮置き");
    p.days[0]!.items = [];
    expect(text).toContain("トロン");
    expect(planToText(p, {}, rideById, null, new Date())).not.toContain("18:10〜18:55");
  });
});
