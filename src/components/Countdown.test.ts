import { describe, expect, it } from "vitest";
import { daysUntilDeparture } from "./Countdown";

describe("カウントダウン", () => {
  it("日本時間で数える（出発前日の昼は残り1日、当日は0日）", () => {
    expect(daysUntilDeparture(Date.UTC(2027, 3, 28, 3))).toBe(1); // 4/28 12:00 JST
    expect(daysUntilDeparture(Date.UTC(2027, 3, 28, 15))).toBe(0); // 4/29 00:00 JST
  });
});
