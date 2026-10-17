import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import type { Plan, PlanItem } from "./plan";
import { bookingSteps, daysUntil } from "./reservations";

const it_ = (rideId: string, slot: PlanItem["slot"], method: PlanItem["method"]): PlanItem => ({ rideId, slot, method });
const plan: Plan = {
  updatedBy: null,
  updatedAt: null,
  days: [
    { date: "2027-05-01", morningPark: "EP", eveningPark: "EP", items: [it_("guardians", "am", "single"), it_("dine-garden-grill", "dinner", "meal"), it_("test-track", "pm", "multiExtra")] },
    { date: "2027-05-02", morningPark: "MK", eveningPark: "MK", items: [it_("tron", "am", "single"), it_("seven-dwarfs", "am", "multi"), it_("dine-cinderella-royal-table", "lunch", "meal")] },
  ],
};
const steps = bookingSteps(plan, rideById);

describe("予約の段取り（いつ・何を・どの順番で）", () => {
  it("準備 → 食事 → 時短パス → 当日 の順", () => {
    expect(steps.map((s) => s.id)).toEqual(["prep", "dining", "ll", "dayOf"]);
  });
  it("食事は取りにくい店（シンデレラ城）を、日付が後でも先に", () => {
    const d = steps.find((s) => s.id === "dining")!;
    expect(d.tasks[0]?.rideIds[0]).toBe("dine-cinderella-royal-table");
    expect(d.when).toContain("2027年3月1日(月) 20:00");
  });
  it("時短パスは Single Pass（日付順）→ Multi Pass", () => {
    const ll = steps.find((s) => s.id === "ll")!;
    expect(ll.tasks.map((t) => t.kind)).toEqual(["single", "single", "multi", "multi"]);
    expect(ll.tasks[0]?.rideIds[0]).toBe("guardians");
    expect(ll.when).toContain("2027年4月23日(金) 20:00");
  });
  it("当日の追加予約は覚え書きとして出る", () => {
    expect(steps.find((s) => s.id === "dayOf")?.notes[0]).toContain("テスト・トラック");
  });
  it("あと何日", () => {
    const at = new Date("2027-03-01T11:00:00Z");
    expect(daysUntil(at, new Date("2027-02-27T11:00:00Z"))).toBe(2);
    expect(daysUntil(at, new Date("2027-03-02T00:00:00Z"))).toBe(0);
  });
});

describe("E06: 時短パスの順番は1つの基準（Single Pass が先、Multi Pass は取りにくい日から）", async () => {
  const { llDayDifficulty } = await import("./reservations");
  it("★の多い日の Multi Pass を、日付が後でも先にする", () => {
    const p: Plan = {
      updatedBy: null,
      updatedAt: null,
      days: [
        { date: "2027-05-01", morningPark: "EP", eveningPark: "EP", items: [it_("test-track", "am", "multi")] },
        { date: "2027-05-02", morningPark: "MK", eveningPark: "MK", items: [it_("seven-dwarfs", "am", "multi"), it_("space-mountain", "pm", "multi")] },
      ],
    };
    const ll = bookingSteps(p, rideById).find((s) => s.id === "ll")!;
    const multiDates = ll.tasks.filter((t) => t.kind === "multi").map((t) => t.id.split(":")[1]);
    expect(multiDates).toEqual(["2027-05-02", "2027-05-01"]);
    expect(llDayDifficulty(p.days[1]!, rideById)).toBeGreaterThan(llDayDifficulty(p.days[0]!, rideById));
  });
});
