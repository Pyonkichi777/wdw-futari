import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import type { DayPlan } from "./plan";
import { dayTimes, timeHints } from "./bookTimes";

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
    expect(h.get("tron")?.text).toMatch(/^\d+:\d{2}頃（予約する枠 (8|9):(00|30)〜(9|10):(00|30)）$/);
    const w = h.get("tron")!.window!;
    expect(h.get("tron")!.at).toBeGreaterThanOrEqual(w.from);
    expect(h.get("tron")!.at).toBeLessThan(w.to);
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

describe("時刻は上から下へ進む（前の項目より前の時刻にならない）", async () => {
  const { dayTimeline } = await import("./timing");
  const { optimizePlan } = await import("./route");
  it("朝イチの後の朝食は、朝イチより後の時刻", () => {
    const d: DayPlan = {
      date: "2027-05-01",
      morningPark: "EP",
      eveningPark: "EP",
      items: [
        { rideId: "remy", slot: "early", method: "early" },
        { rideId: "park-creperie-de-paris", slot: "am", method: "meal" },
        { rideId: "test-track", slot: "am", method: "standby" },
      ],
    };
    const day = optimizePlan({ days: [d], updatedBy: null, updatedAt: null }).days[0]!;
    const h = timeHints(day, rideById);
    expect(h.get("park-creperie-de-paris")!.at).toBeGreaterThan(h.get("remy")!.at);
    // 並びの順に時刻が増えていく
    const order = dayTimeline(day, rideById).segments.flatMap((s) => (s.type === "item" ? [h.get(s.ride.id)!.at] : []));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
  it("朝食がその日の最初なら、開園前の 8:00 頃", () => {
    const d: DayPlan = { date: "2027-05-01", morningPark: "EP", eveningPark: "EP", items: [{ rideId: "park-creperie-de-paris", slot: "am", method: "meal" }, { rideId: "test-track", slot: "am", method: "standby" }] };
    expect(timeHints(d, rideById).get("park-creperie-de-paris")?.text).toBe("8:00頃");
  });
});

describe("改善提案 E02・E05", () => {
  it("E02: 8:30の朝イチ（約35分）の次は、9:05より前の時刻を出さない", () => {
    const d: DayPlan = {
      date: "2027-05-03",
      morningPark: "HS",
      eveningPark: "HS",
      items: [
        { rideId: "rise-of-the-resistance", slot: "early", method: "early" },
        { rideId: "millennium-falcon", slot: "am", method: "standby" },
      ],
    };
    const h = timeHints(d, rideById);
    expect(h.get("millennium-falcon")!.at).toBeGreaterThanOrEqual(9 * 60 + 5);
  });
  it("E05: 朝の予定がなく夕食だけの日は、9:00パーク着とせず夕食に合わせる", () => {
    const d: DayPlan = { date: "2027-05-05", morningPark: "AK", eveningPark: "MK", items: [{ rideId: "dine-cinderella-royal-table", slot: "dinner", method: "meal" }] };
    const t = dayTimes(d, rideById);
    expect(t.lateStart).toBe(true);
    expect(t.start).toBe(17 * 60 + 30);
  });
});

describe("改善提案v2 I02・N01・I05", () => {
  const day: DayPlan = {
    date: "2027-05-04",
    morningPark: "AK",
    eveningPark: "AK",
    items: [
      { rideId: "dine-tusker-house", slot: "lunch", method: "meal" },
      { rideId: "lion-king", slot: "pm", method: "show" },
      { rideId: "kilimanjaro", slot: "pm", method: "multi" },
      { rideId: "zootopia", slot: "pm", method: "show" },
    ],
  };
  it("I02: 上から順に読んで、次の予定は前の予定の終わり（開始＋所要時間）より前にならない", async () => {
    const { dayTimeline } = await import("./timing");
    const t = dayTimes(day, rideById);
    const segs = dayTimeline(day, rideById).segments.flatMap((s) => (s.type === "item" ? [s] : []));
    for (let i = 1; i < segs.length; i++) {
      const prev = t.hints.get(segs[i - 1]!.ride.id)!;
      const cur = t.hints.get(segs[i]!.ride.id)!;
      expect(cur.at, segs[i]!.ride.id).toBeGreaterThanOrEqual(prev.at + segs[i - 1]!.minutes);
    }
  });
  it("N01: ショー・パレードの時刻は仮置きと表示", () => {
    const h = timeHints(day, rideById);
    expect(h.get("lion-king")?.tentative).toBe(true);
    expect(h.get("lion-king")?.text).toContain("仮置き");
  });
  it("I05: 取れた予約の時刻に合わせ、前の予定から間に合わなければ知らせる", () => {
    const h = timeHints(day, rideById, null, new Map([["kilimanjaro", 12 * 60]]));
    expect(h.get("kilimanjaro")).toMatchObject({ at: 12 * 60, fixed: true, late: true });
    const ok = timeHints(day, rideById, null, new Map([["kilimanjaro", 16 * 60]]));
    expect(ok.get("kilimanjaro")?.late).toBeUndefined();
    expect(ok.get("zootopia")!.at).toBeGreaterThanOrEqual(16 * 60);
  });
});

describe("改善提案v2 N02・N04", async () => {
  const { dayTimeline } = await import("./timing");
  it("N02: パーク着〜ホテル着 = 予定の時間 + 空き時間", () => {
    const d: DayPlan = { date: "2027-05-01", morningPark: "MK", eveningPark: "MK", items: [{ rideId: "tron", slot: "early", method: "early" }, { rideId: "dine-cinderella-royal-table", slot: "dinner", method: "meal" }] };
    const t = dayTimes(d, rideById);
    expect(t.end - t.start).toBe(t.busy + t.idle);
    expect(t.idle).toBeGreaterThan(5 * 60);
  });
  it("N04: 予定のない日・予定のない「夕方から」のパークへは移動を描かない", () => {
    expect(dayTimeline({ date: "2027-05-05", morningPark: "AK", eveningPark: "AK", items: [] }, rideById).segments).toEqual([]);
    const segs = dayTimeline({ date: "2027-05-04", morningPark: "AK", eveningPark: "EP", items: [{ rideId: "everest", slot: "am", method: "standby" }] }, rideById).segments;
    expect(segs.some((s) => s.type === "travel" && s.to === "EP")).toBe(false);
  });
});

describe("取れた予約: 最遅だと間に合わない場合", () => {
  it("前の時短パスを枠の最後に乗ると間に合わないときは worstLate", () => {
    const d: DayPlan = {
      date: "2027-05-04",
      morningPark: "MK",
      eveningPark: "MK",
      items: [
        { rideId: "seven-dwarfs", slot: "am", method: "multi" },
        { rideId: "peter-pan", slot: "am", method: "standby" },
      ],
    };
    const first = timeHints(d, rideById).get("seven-dwarfs")!;
    // 最初の時短パスの枠の終わりより少し前に、次の予約が取れた
    const got = first.window!.to;
    const h = timeHints(d, rideById, null, new Map([["peter-pan", got]]));
    expect(h.get("peter-pan")?.late).toBeUndefined();
    expect(h.get("peter-pan")?.worstLate).toBe(true);
  });
});
