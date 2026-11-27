import { describe, expect, it } from "vitest";
import { fixedTimesFor, isChecked, isGotTime, parseChecks } from "./checks";

describe("I05: 取れた予約の時刻", () => {
  const checks = parseChecks({
    "dine:2027-05-04:dine-tusker-house": { by: "toshi", at: 1, got: { "dine-tusker-house": "11:45", bad: "1145" } },
    "mp:2027-05-04": { by: "tsuma", at: 2, got: { kilimanjaro: "14:10", everest: "10:00" } },
    "sp:2027-05-02:tron": { by: "toshi", at: 3 },
  });
  it("形の正しい時刻だけ読み、その日の分を分に直す", () => {
    expect(checks["dine:2027-05-04:dine-tusker-house"]?.got).toEqual({ "dine-tusker-house": "11:45" });
    expect([...fixedTimesFor(checks, "2027-05-04")].sort()).toEqual([["dine-tusker-house", 705], ["everest", 600], ["kilimanjaro", 850]]);
    expect(fixedTimesFor(checks, "2027-05-02").size).toBe(0);
  });
});

describe("R01: 取得枠と旧形式", () => {
  it("旧時刻はそのまま、新しい到着枠は終了を推測せず読み込む", () => {
    const c = parseChecks({ "mp:2027-05-04": { by: "tsuma", at: 1, got: { legacy: "10:00", current: { from: "10:15", to: "10:55" }, bad: "29:60", reversed: { from: "11:00", to: "10:00" } } } });
    expect([...fixedTimesFor(c, "2027-05-04")]).toEqual([["legacy", 600], ["current", { from: 615, to: 655 }]]);
    expect(isGotTime({ from: "10:00", to: "10:00" })).toBe(false);
  });
  it("チェックを外した保存枠は保持するが、作戦の固定時刻には使わない", () => {
    const c = parseChecks({ "mp:2027-05-04": { by: "tsuma", at: 1, done: false, got: { ride: "10:00" } } });
    expect(isChecked(c["mp:2027-05-04"])).toBe(false);
    expect(c["mp:2027-05-04"]?.got).toEqual({ ride: "10:00" });
    expect(fixedTimesFor(c, "2027-05-04").size).toBe(0);
  });
});
