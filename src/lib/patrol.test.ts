import { describe, expect, it } from "vitest";
import { patrolStatus } from "./patrol";

describe("I04: 毎朝の巡回が止まっていないか", () => {
  const now = new Date("2026-10-18T03:00:00Z"); // 日本時間 10/18 12:00
  it("今日・昨日なら正常、2日以上前なら止まっている", () => {
    expect(patrolStatus("2026-10-18", now)).toEqual({ last: "2026-10-18", daysAgo: 0, stale: false });
    expect(patrolStatus("2026-10-17", now).stale).toBe(false);
    expect(patrolStatus("2026-10-16", now)).toMatchObject({ daysAgo: 2, stale: true });
  });
  it("記録がなければ注意", () => {
    expect(patrolStatus(null, now).stale).toBe(true);
  });
});
