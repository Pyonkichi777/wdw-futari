import { describe, expect, it } from "vitest";
import { fixedTimesFor, parseChecks } from "./checks";

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
