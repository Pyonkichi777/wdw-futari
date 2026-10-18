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
  it("全日・全区間に余裕5分。動き続けて1時間半を超える前にトイレ休憩15分が入る", () => {
    for (const d of plan.days) {
      const segs = dayTimeline(d, rideById).segments;
      let active = 0;
      let lastWasItem = false;
      for (const s of segs) {
        if (s.type === "gap") {
          expect(s.gap.buffer).toBe(BUFFER_MINUTES);
          if (s.gap.rest > 0) {
            expect(s.gap.rest).toBe(REST_MINUTES);
            active = 0;
          }
          active += s.gap.walk + s.gap.buffer;
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
