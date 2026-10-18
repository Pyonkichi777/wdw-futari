import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import type { DayPlan } from "./plan";
import { dayAdvice } from "./dayAdvice";
import { nextTheme } from "./theme";

const hsDay: DayPlan = {
  date: "2027-05-03",
  morningPark: "HS",
  eveningPark: "HS",
  items: [
    { rideId: "rise-of-the-resistance", slot: "early", method: "early", shop: 15 },
    { rideId: "millennium-falcon", slot: "am", method: "singleRider" },
    { rideId: "runaway-railway", slot: "am", method: "multi", shop: 15 },
    { rideId: "tower-of-terror", slot: "pm", method: "multi", shop: 15 },
    { rideId: "fantasmic", slot: "night", method: "show" },
  ],
};

describe("空き時間3時間以上・食事なし（🟡）", () => {
  it("お送りいただいた5/3の形: 昼から夜までの空き、昼食・夕食なしを知らせる", () => {
    const a = dayAdvice(hsDay, rideById);
    expect(a.idle).toHaveLength(1);
    expect(a.idle[0]!.to - a.idle[0]!.from).toBeGreaterThanOrEqual(180);
    expect(a.idle[0]!.hotelRoundTrip).toBe(40);
    expect(a.noLunch).toBe(true);
    expect(a.noDinner).toBe(true);
  });
  it("昼食・夕食を入れると、食事の注意は消える", () => {
    const withMeals: DayPlan = {
      ...hsDay,
      items: [...hsDay.items.slice(0, 4), { rideId: "dine-hollywood-vine", slot: "lunch", method: "meal" }, { rideId: "dine-hollywood-vine", slot: "dinner", method: "meal" }, hsDay.items[4]!],
    };
    const a = dayAdvice(withMeals, rideById);
    expect(a.noLunch).toBe(false);
    expect(a.noDinner).toBe(false);
  });
});

describe("画面の明るさの切り替え", () => {
  it("自動 → ライト → ダーク → 自動", () => {
    expect(nextTheme("auto")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("auto");
  });
});
