import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import { onlyMealText } from "./MealPicker";

describe("1つの時間帯しかない店の説明", () => {
  it("オハナの夕食（キャラクターなし）は「会える」と言わない", () => {
    const t = onlyMealText(rideById("hotel-ohana-dinner")!, "dinner");
    expect(t).toContain("キャラクターは出ません");
    expect(t).not.toContain("会える");
  });
  it("オハナの朝食（リロとスティッチ）は「朝食だけ会える」", () => {
    expect(onlyMealText(rideById("dine-ohana")!, "breakfast")).toContain("会えるのは朝食だけ");
  });
});
