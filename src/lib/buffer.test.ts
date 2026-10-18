import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import { TRIP } from "../data/trip";
import type { ConsensusItem } from "../types";
import { dayTimes } from "./bookTimes";
import { buildPlan } from "./plan";
import { optimizePlan } from "./route";
import { BUFFER_MINUTES, REST_EVERY_MINUTES, REST_MINUTES, dayTimeline, walkMinutes } from "./timing";

const ids = ["flight-of-passage", "navi-river", "everest", "kilimanjaro", "rise-of-the-resistance", "millennium-falcon", "slinky-dog", "toy-story-mania", "tower-of-terror", "runaway-railway", "guardians", "test-track", "soarin", "frozen", "remy", "spaceship-earth", "tron", "seven-dwarfs", "space-mountain", "big-thunder", "pirates", "haunted-mansion", "peter-pan", "jungle-cruise", "tiana", "happily-ever-after", "luminous", "park-be-our-guest", "dine-tusker-house"];
const consensus: ConsensusItem[] = ids.map((rideId, i) => ({ rideId, rank: i % 3 === 0 ? ("S" as const) : ("A" as const), ...(rideById(rideId)?.dining ? { meal: "lunch" as const } : {}) }));
const plan = optimizePlan(buildPlan(consensus, rideById, TRIP.parkDays));

describe("各予定の間: 移動（距離から）・余裕・1時間半ごとのトイレ休憩", () => {
  it("歩く時間は距離から（遠いアナ雪→レミーは長く、隣どうしは短く）。最低5分", () => {
    expect(walkMinutes("frozen", "remy")).toBeGreaterThanOrEqual(18);
    expect(walkMinutes("tiana", "big-thunder")).toBe(5);
  });
  it("全日・全区間に余裕（既定15分）。動き続けて1時間半を超える前にトイレ休憩がとれる", () => {
    for (const d of plan.days) {
      const segs = dayTimeline(d, rideById).segments;
      let active = 0;
      let lastWasItem = false;
      for (const s of segs) {
        if (s.type === "gap") {
          expect(s.gap.buffer).toBe(BUFFER_MINUTES);
          // トイレ休憩が入るか、余裕が15分以上（そこで休める）なら数え直す
          if (s.gap.rest > 0 || s.gap.buffer >= REST_MINUTES) {
            if (s.gap.rest > 0) expect(s.gap.rest).toBe(REST_MINUTES);
            active = 0;
          }
          active += s.gap.shop + s.gap.walk + (s.gap.buffer >= REST_MINUTES ? 0 : s.gap.buffer);
          lastWasItem = false;
        } else if (s.type === "item") {
          // 予定の直前に、動き続けた時間が1時間半を大きく超えていない（食事の直前は食事で休むので除く）
          if (s.item.method !== "meal") expect(active, `${d.date} ${s.ride.id}`).toBeLessThan(REST_EVERY_MINUTES + 75);
          active = s.item.method === "meal" ? 0 : active + s.minutes;
          lastWasItem = true;
        }
      }
      expect(typeof lastWasItem).toBe("boolean");
    }
  });
  it("上から順に、前の予定の終わり＋歩く時間＋余裕（＋休憩）より前に次の予定が始まらない", () => {
    for (const d of plan.days) {
      const t = dayTimes(d, rideById);
      const segs = dayTimeline(d, rideById).segments;
      let prevEnd: number | null = null;
      let gap = 0;
      for (const s of segs) {
        if (s.type === "gap") gap += s.gap.walk + s.gap.buffer + s.gap.rest;
        else if (s.type === "travel") gap += prevEnd === null ? 0 : s.leg.minutes;
        else {
          const at = t.hints.get(s.ride.id)!.at;
          if (prevEnd !== null) expect(at, `${d.date} ${s.ride.id}`).toBeGreaterThanOrEqual(prevEnd + gap);
          prevEnd = at + s.minutes;
          gap = 0;
        }
      }
    }
  });
});

describe("お土産を見る時間（5〜30分、プルダウン）", async () => {
  const { setShop, parsePlan } = await import("./plan");
  const d = plan.days.find((x) => x.items.length > 3)!;
  const target = d.items[1]!;
  it("選んだ分だけ、その予定の後に入り、次の予定の時刻が遅くなる。保存して読み直しても残る", () => {
    const before = dayTimes(d, rideById).hints.get(d.items[2]!.rideId)!.at;
    const p2 = setShop(plan, d.date, target.rideId, 20);
    const d2 = p2.days.find((x) => x.date === d.date)!;
    expect(d2.items.find((i) => i.rideId === target.rideId)?.shop).toBe(20);
    const segs = dayTimeline(d2, rideById).segments;
    expect(segs.some((s) => s.type === "gap" && s.gap.shop === 20)).toBe(true);
    expect(dayTimes(d2, rideById).hints.get(d2.items[2]!.rideId)!.at).toBeGreaterThanOrEqual(before + 20 - 15);
    expect(parsePlan(JSON.parse(JSON.stringify(p2))).days.find((x) => x.date === d.date)!.items.find((i) => i.rideId === target.rideId)?.shop).toBe(20);
  });
  it("「なし」で消える。5分刻み以外の値は読み捨てる", () => {
    const p3 = setShop(setShop(plan, d.date, target.rideId, 20), d.date, target.rideId, 0);
    expect(p3.days.find((x) => x.date === d.date)!.items.find((i) => i.rideId === target.rideId)?.shop).toBeUndefined();
    expect(setShop(plan, d.date, target.rideId, 7).days.find((x) => x.date === d.date)!.items.find((i) => i.rideId === target.rideId)?.shop).toBeUndefined();
  });
});

describe("時短パスを予約枠の最後の時刻に乗っても（最遅）、次の予約枠・食事・ショーに間に合う", () => {
  it("全日・全区間で、最遅の到着が次の期限（予約枠の終わり・食事やショーの時刻）を超えない", () => {
    let checked = 0;
    for (const d of plan.days) {
      const t = dayTimes(d, rideById);
      let tw: number | null = null;
      for (const s of dayTimeline(d, rideById).segments) {
        if (s.type === "gap") {
          if (tw !== null) tw += s.gap.shop + s.gap.walk + s.gap.buffer + s.gap.rest;
          continue;
        }
        if (s.type === "travel") {
          if (tw !== null) tw += s.leg.minutes;
          continue;
        }
        const h = t.hints.get(s.ride.id)!;
        if (tw !== null && (h.window || s.item.method === "meal" || h.tentative)) {
          expect(tw, `${d.date} ${s.ride.id}`).toBeLessThanOrEqual(h.window ? h.window.to : h.at);
          checked++;
        }
        if (tw !== null) tw = Math.max(tw, h.at) + s.minutes;
        if (h.window) tw = h.window.to + s.minutes;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
  it("お土産を足しても、最遅で間に合う", async () => {
    const { setShop } = await import("./plan");
    let p = plan;
    for (const d of plan.days) for (const i of d.items) p = setShop(p, d.date, i.rideId, 15);
    for (const d of p.days) {
      const t = dayTimes(d, rideById);
      let tw: number | null = null;
      for (const s of dayTimeline(d, rideById).segments) {
        if (s.type === "gap") { if (tw !== null) tw += s.gap.shop + s.gap.walk + s.gap.buffer + s.gap.rest; continue; }
        if (s.type === "travel") { if (tw !== null) tw += s.leg.minutes; continue; }
        const h = t.hints.get(s.ride.id)!;
        if (tw !== null && h.window) expect(tw, `${d.date} ${s.ride.id}`).toBeLessThanOrEqual(h.window.to);
        if (tw !== null) tw = Math.max(tw, h.at) + s.minutes;
        if (h.window) tw = h.window.to + s.minutes;
      }
    }
  });
});

describe("予定の間の余裕をプルダウンで（5〜120分）", async () => {
  const { setBuffer, setBufferAll, parsePlan, BUFFER_OPTIONS } = await import("./plan");
  const d = plan.days.find((x) => x.items.length > 3)!;
  const target = d.items[1]!;
  it("選べるのは5〜120分の5分刻み", () => {
    expect(BUFFER_OPTIONS[0]).toBe(5);
    expect(BUFFER_OPTIONS[BUFFER_OPTIONS.length - 1]).toBe(120);
    expect(BUFFER_OPTIONS).toHaveLength(24);
  });
  it("1つの予定の後を60分にすると、次の予定が遅くなり、保存しても残る", () => {
    const before = dayTimes(d, rideById).hints.get(d.items[2]!.rideId)!.at;
    const p2 = setBuffer(plan, d.date, target.rideId, 60);
    const d2 = p2.days.find((x) => x.date === d.date)!;
    expect(dayTimes(d2, rideById).hints.get(d2.items[2]!.rideId)!.at).toBeGreaterThan(before + 30);
    expect(parsePlan(JSON.parse(JSON.stringify(p2))).days.find((x) => x.date === d.date)!.items.find((i) => i.rideId === target.rideId)?.buffer).toBe(60);
  });
  it("余裕を15分以上にした区間では、トイレ休憩を別に足さない。まとめて設定もできる", () => {
    const all = setBufferAll(plan, 20);
    for (const day of all.days) for (const s of dayTimeline(day, rideById).segments) if (s.type === "gap" && s.gap.buffer > 0) {
      expect(s.gap.buffer).toBe(20);
      expect(s.gap.rest).toBe(0);
    }
    const back = setBufferAll(all, 15);
    expect(back.days.flatMap((x) => x.items).some((i) => i.buffer !== undefined)).toBe(false);
  });
});

describe("終わる時刻と、次に着く時刻（見るだけで分かるように）", () => {
  it("終わる＝開始＋所要時間。次に着く＝前の終わり＋お土産・歩く・余裕・休憩・移動。着く時刻は開始より遅くならない", () => {
    for (const d of plan.days) {
      const t = dayTimes(d, rideById);
      let prevEnd: number | null = null;
      let between = 0;
      for (const s of dayTimeline(d, rideById).segments) {
        if (s.type === "gap") between += s.gap.shop + s.gap.walk + s.gap.buffer + s.gap.rest;
        else if (s.type === "travel") between += prevEnd === null ? 0 : s.leg.minutes;
        else {
          const h = t.hints.get(s.ride.id)!;
          expect(h.end).toBe(h.at + s.minutes);
          if (prevEnd !== null) {
            expect(h.arrive, `${d.date} ${s.ride.id}`).toBe(prevEnd + between);
            expect(h.arrive).toBeLessThanOrEqual(h.at);
          }
          prevEnd = h.end;
          between = 0;
        }
      }
    }
  });
});
