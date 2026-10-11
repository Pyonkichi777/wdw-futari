import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import { emptyMeals, parseMealPrefs, suggestMeal, toggleMeal } from "./meals";

const crystal = rideById("dine-crystal-palace")!; // 朝・昼・夜
const topolino = rideById("dine-topolino")!; // 朝だけ

describe("レストランの時間帯の希望", () => {
  it("付け外しすると、朝→昼→夜の順にそろう", () => {
    expect(toggleMeal(undefined, "dinner")).toEqual(["dinner"]);
    expect(toggleMeal(["dinner"], "breakfast")).toEqual(["breakfast", "dinner"]);
    expect(toggleMeal(["breakfast", "dinner"], "dinner")).toEqual(["breakfast"]);
  });

  it("保存データの知らない値は捨てる", () => {
    expect(parseMealPrefs({ a: ["dinner", "brunch", "breakfast"], b: "x", c: [] })).toEqual({ a: ["breakfast", "dinner"] });
  });

  it("店が1つの時間帯しかなければそれ", () => {
    expect(suggestMeal(topolino, emptyMeals())).toEqual({ meal: "breakfast", reason: "only" });
  });

  it("2人とも希望している時間帯を優先", () => {
    const all = { toshi: { [crystal.id]: ["breakfast", "dinner"] as const }, tsuma: { [crystal.id]: ["dinner"] as const } };
    expect(suggestMeal(crystal, all)).toEqual({ meal: "dinner", reason: "both" });
  });

  it("重ならなければ、どちらかの希望のうち早いもの", () => {
    const all = { toshi: { [crystal.id]: ["dinner"] as const }, tsuma: { [crystal.id]: ["lunch"] as const } };
    expect(suggestMeal(crystal, all)).toEqual({ meal: "lunch", reason: "one" });
  });

  it("希望がなければ店の最初の時間帯", () => {
    expect(suggestMeal(crystal, emptyMeals())).toEqual({ meal: "breakfast", reason: "none" });
  });

  it("レストラン以外はおすすめなし", () => {
    expect(suggestMeal(rideById("tron")!, emptyMeals())).toBeNull();
  });
});
