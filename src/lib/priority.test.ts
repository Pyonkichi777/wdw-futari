import { describe, expect, it } from "vitest";
import { isLowPriority } from "./priority";
import { removeItems, type Plan } from "./plan";

describe("優先度の低いもの", () => {
  const votes = { toshi: { a: "either", b: "either", c: "must" }, tsuma: { a: "either", b: "want", c: "either" } } as const;
  it("2人とも「どちらでも」だけが優先度低", () => {
    expect(isLowPriority(votes, "a")).toBe(true);
    expect(isLowPriority(votes, "b")).toBe(false);
    expect(isLowPriority(votes, "c")).toBe(false);
  });
  it("まとめて外す（日を指定すればその日だけ）", () => {
    const plan: Plan = {
      updatedBy: null,
      updatedAt: null,
      days: [
        { date: "d1", morningPark: "MK", eveningPark: "MK", items: [{ rideId: "a", slot: "am", method: "standby" }, { rideId: "c", slot: "am", method: "standby" }] },
        { date: "d2", morningPark: "EP", eveningPark: "EP", items: [{ rideId: "a", slot: "pm", method: "standby" }] },
      ],
    };
    const one = removeItems(plan, new Set(["a"]), "d1");
    expect(one.days[0]?.items.map((i) => i.rideId)).toEqual(["c"]);
    expect(one.days[1]?.items.length).toBe(1);
    const all = removeItems(plan, new Set(["a"]));
    expect(all.days.flatMap((d) => d.items).map((i) => i.rideId)).toEqual(["c"]);
  });
});
