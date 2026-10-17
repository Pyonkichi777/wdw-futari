import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import type { Plan } from "./plan";
import { placeText, placesInPlan } from "./planLookup";

describe("ニュースから今の作戦を引く", () => {
  const plan: Plan = {
    updatedBy: null,
    updatedAt: null,
    days: [
      { date: "2027-05-04", morningPark: "AK", eveningPark: "AK", items: [{ rideId: "flight-of-passage", slot: "early", method: "early" }, { rideId: "everest", slot: "pm", method: "multi" }] },
    ],
  };
  it("入っていれば日付・目安時刻・乗り方、なければ空", () => {
    const p = placesInPlan(plan, "everest", rideById);
    expect(p).toHaveLength(1);
    expect(placeText(p[0]!)).toMatch(/^5\/4\(火\) \d+:\d{2}頃（予約する枠 \d+:\d{2}〜\d+:\d{2}）・Multi Pass/);
    expect(placesInPlan(plan, "soarin", rideById)).toEqual([]);
  });
});
