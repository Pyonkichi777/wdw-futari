import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import { TRIP } from "../data/trip";
import type { ConsensusItem } from "../types";
import { buildPlan, moveItem, parsePlan, unpinItem, type Plan } from "./plan";
import { optimizePlan, walkKm } from "./route";

const consensus: ConsensusItem[] = ["tron", "seven-dwarfs", "space-mountain", "big-thunder", "pirates", "haunted-mansion", "peter-pan", "jungle-cruise", "buzz-lightyear", "small-world", "tiana"].map((rideId) => ({ rideId, rank: "A" as const }));
const base = optimizePlan(buildPlan(consensus, rideById, TRIP.parkDays));
const mk = base.days.find((d) => d.items.length > 4)!;
const parkOf = (id: string) => rideById(id)?.park;
const ids = (p: Plan, date: string) => p.days.find((d) => d.date === date)!.items.map((i) => `${i.slot}:${i.rideId}`);

describe("道順はいつも近い順", () => {
  it("近い順にしたものを、もう一度近い順にしても変わらない", () => {
    expect(optimizePlan(base)).toEqual(base);
  });
  it("わざと遠回りに並べ替えても、近い順に戻る（歩く距離が増えない）", () => {
    const shuffled: Plan = { ...base, days: base.days.map((d) => (d.date === mk.date ? { ...d, items: [...d.items].reverse() } : d)) };
    const fixed = optimizePlan(shuffled);
    const km = (p: Plan) => walkKm(p.days.find((d) => d.date === mk.date)!.items, parkOf);
    expect(km(fixed)).toBeLessThanOrEqual(km(base) + 0.01);
  });
  it("手で午前→午後に動かしたもの（📌）は、近い順にしても午後のまま。固定を外すと自動に戻る", () => {
    const amItem = mk.items.find((i) => i.slot === "am" && i.method !== "early")!;
    const moved = optimizePlan(moveItem(base, amItem.rideId, { date: mk.date, slot: "pm", method: amItem.method }, { pin: true }));
    expect(ids(moved, mk.date)).toContain(`pm:${amItem.rideId}`);
    expect(parsePlan(JSON.parse(JSON.stringify(moved))).days.find((d) => d.date === mk.date)!.items.find((i) => i.rideId === amItem.rideId)?.pinned).toBe(true);
    const unpinned = optimizePlan(unpinItem(moved, amItem.rideId));
    expect(unpinned.days.find((d) => d.date === mk.date)!.items.find((i) => i.rideId === amItem.rideId)?.pinned).toBeUndefined();
  });
});
