import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import { TRIP } from "../data/trip";
import type { ConsensusItem } from "../types";
import { buildPlan, parsePlan, restoreItem, withKept, type Plan } from "./plan";
import { excludeAllLow } from "./planFixes";
import { reservationTasks } from "./reservations";
import { timeHints } from "./bookTimes";

const consensus: ConsensusItem[] = [
  { rideId: "flight-of-passage", rank: "S" },
  { rideId: "rise-of-the-resistance", rank: "S" },
  { rideId: "tron", rank: "S" },
  { rideId: "guardians", rank: "S" },
  { rideId: "space-mountain", rank: "A" },
  { rideId: "slinky-dog", rank: "A" },
  { rideId: "pirates", rank: "B" },
  { rideId: "small-world", rank: "B" },
  { rideId: "buzz-lightyear", rank: "B" },
  { rideId: "soarin", rank: "B" },
  { rideId: "kali-river", rank: "B" },
  { rideId: "park-be-our-guest", rank: "A", meal: "lunch" },
];
const LOW = new Set(["pirates", "small-world", "buzz-lightyear", "soarin", "kali-river"]);
const isLow = (id: string) => LOW.has(id);
const placed = (p: Plan) => p.days.flatMap((d) => d.items.map((i) => i.rideId));

/** 作戦タブの「作り直す」と同じ手順 */
const regenerate = (cur: Plan, focusParks: Plan["focusParks"] = []): Plan => {
  const base = cur.dropLow ? excludeAllLow(cur, consensus, isLow, rideById, "toshi") : cur;
  const p = buildPlan(consensus, rideById, TRIP.parkDays, { focusParks: focusParks ?? [], ...(base.excluded ? { excluded: base.excluded } : {}) });
  return { ...p, ...(base.dropLow ? { dropLow: true as const } : {}), ...(base.keptLow ? { keptLow: base.keptLow } : {}) };
};

describe("「2人ともどちらでも」を一度まとめて外したら、戻らない", () => {
  const plan = buildPlan(consensus, rideById, TRIP.parkDays);
  const dropped = excludeAllLow(plan, consensus, isLow, rideById, "toshi");

  it("日に入っていたものも、入っていなかったものも全部「外したもの」に", () => {
    expect(placed(dropped).filter(isLow)).toEqual([]);
    expect(new Set((dropped.excluded ?? []).map((e) => e.rideId))).toEqual(LOW);
    expect(dropped.dropLow).toBe(true);
  });

  it("作り直しても、優先順位を変えても入らない（保存して読み直しても）", () => {
    for (const fp of [[], ["MK", "HS", "EP", "AK"], ["AK"]] as const) {
      const p = regenerate(parsePlan(JSON.parse(JSON.stringify(dropped))), [...fp]);
      expect(placed(p).filter(isLow)).toEqual([]);
      expect(p.dropLow).toBe(true);
    }
  });

  it("自分で戻したものだけは、作り直しても残る", () => {
    const r = withKept(restoreItem(dropped, "pirates", (id) => rideById(id)?.park), ["pirates"]);
    expect(placed(r)).toContain("pirates");
    const p = regenerate(r);
    expect(placed(p)).toContain("pirates");
    expect(placed(p).filter((id) => isLow(id) && id !== "pirates")).toEqual([]);
  });
});

describe("作戦の時刻と、予約の「選ぶ時間枠」は同じ", () => {
  it("Single Pass・Multi Pass・食事の時間枠は、作戦に出る時刻と一致する", () => {
    const plan = buildPlan(consensus, rideById, TRIP.parkDays);
    const tasks = reservationTasks(plan, rideById);
    let checked = 0;
    for (const d of plan.days) {
      const h = timeHints(d, rideById);
      for (const it of d.items) {
        if (!["single", "multi", "meal"].includes(it.method)) continue;
        const text = h.get(it.rideId)?.text;
        const t = tasks.find((x) => x.rideIds.includes(it.rideId) && x.id.includes(d.date) && x.kind !== "singleOptional");
        if (!t || !text) continue;
        expect(t.pick).toContain(text);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(2);
  });
});
