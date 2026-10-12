import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import type { DayPlan } from "./plan";
import { dayTimes } from "./bookTimes";
import { parseHoursFeed } from "./hours";

const feed = parseHoursFeed({
  source: { name: "公式", url: "https://disneyworld.disney.go.com/calendars/" },
  fetchedAt: "2027-03-20",
  days: { "2027-05-02": { MK: { early: "07:30", open: "08:00", close: "23:00" }, EP: { open: "9:00", close: "21:00" } } },
});
const day = (early: boolean): DayPlan => ({
  date: "2027-05-02",
  morningPark: "MK",
  eveningPark: "MK",
  items: [early ? { rideId: "seven-dwarfs", slot: "early", method: "early" } : { rideId: "seven-dwarfs", slot: "am", method: "standby" }],
});

describe("公式の営業時間（hours.json）", () => {
  it("形のおかしい時刻は捨てる", () => {
    expect(feed?.days["2027-05-02"]?.EP).toBeUndefined();
    expect(feed?.days["2027-05-02"]?.MK?.early).toBe("07:30");
  });
  it("公式の時刻が出ていれば、それで1日の時刻を計算する（予約の時間枠も同じ）", () => {
    expect(dayTimes(day(true), rideById, feed)).toMatchObject({ start: 7 * 60 + 30, official: true });
    expect(dayTimes(day(false), rideById, feed).start).toBe(8 * 60);
  });
  it("出ていなければ 9:00（開園前入園 8:30）と仮定", () => {
    expect(dayTimes(day(true), rideById, null)).toMatchObject({ start: 8 * 60 + 30, official: false });
  });
});
