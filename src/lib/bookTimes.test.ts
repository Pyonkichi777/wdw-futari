import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import type { DayPlan } from "./plan";
import { timeHints } from "./bookTimes";

const day: DayPlan = {
  date: "2027-05-02",
  morningPark: "MK",
  eveningPark: "MK",
  items: [
    { rideId: "seven-dwarfs", slot: "early", method: "early" },
    { rideId: "tron", slot: "am", method: "single" },
    { rideId: "space-mountain", slot: "am", method: "multi" },
    { rideId: "park-be-our-guest", slot: "lunch", method: "meal" },
    { rideId: "dine-cinderella-royal-table", slot: "dinner", method: "meal" },
  ],
};
const h = timeHints(day, rideById);

describe("予約で選ぶ時間枠のおすすめ", () => {
  it("開園前入園の日は8:30から数えて、時短パスは1時間の枠", () => {
    expect(h.get("tron")?.text).toMatch(/^(8|9):(00|30)〜(9|10):(00|30)の枠$/);
    expect(h.get("space-mountain")!.at).toBeGreaterThan(h.get("tron")!.at);
  });
  it("昼食は11:30〜13:30、夕食は17:30〜19:00の間", () => {
    const lunch = h.get("park-be-our-guest")!.at;
    const dinner = h.get("dine-cinderella-royal-table")!.at;
    expect(lunch).toBeGreaterThanOrEqual(11 * 60 + 30);
    expect(lunch).toBeLessThanOrEqual(13 * 60 + 30);
    expect(dinner).toBeGreaterThanOrEqual(17 * 60 + 30);
    expect(dinner).toBeLessThanOrEqual(19 * 60);
  });
});
