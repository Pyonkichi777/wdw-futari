import { describe, expect, it } from "vitest";
import { emptyPlan, type Plan } from "./plan";
import { planDiff } from "./planDiff";

describe("I09: 戻す前の差分", () => {
  const a: Plan = { ...emptyPlan(), days: [{ date: "2027-05-01", morningPark: "EP", eveningPark: "EP", items: [{ rideId: "guardians", slot: "early", method: "early" }] }] };
  const b: Plan = { ...emptyPlan(), days: [{ date: "2027-05-01", morningPark: "MK", eveningPark: "MK", items: [{ rideId: "tron", slot: "early", method: "early" }] }] };
  it("日割りの変化と、入る・外れる予定を書く", () => {
    const d = planDiff(a, b, (id) => id);
    expect(d).toEqual(["5/1: エプコット → マジックキングダム・入る 1件（tron）・外れる 1件（guardians）"]);
    expect(planDiff(a, a, (id) => id)).toEqual([]);
  });
});
