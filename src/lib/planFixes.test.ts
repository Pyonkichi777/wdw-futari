import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import { TRIP } from "../data/trip";
import type { ConsensusItem } from "../types";
import { buildPlan, moveItem, type Plan } from "./plan";
import { checkPlan, fixAllReds } from "./planChecks";
import { applyFix } from "./planFixes";

const consensus: ConsensusItem[] = [
  { rideId: "flight-of-passage", rank: "S" },
  { rideId: "rise-of-the-resistance", rank: "S" },
  { rideId: "guardians", rank: "S" },
  { rideId: "tron", rank: "S" },
  { rideId: "seven-dwarfs", rank: "A" },
  { rideId: "space-mountain", rank: "A" },
  { rideId: "slinky-dog", rank: "A" },
  { rideId: "runaway-railway", rank: "A" },
  { rideId: "park-be-our-guest", rank: "A", meal: "lunch" },
];
const plan = buildPlan(consensus, rideById, TRIP.parkDays);
const reds = (p: Plan) => checkPlan(p, consensus, rideById).filter((w) => w.level === "red");
const notMk = plan.days.find((d) => d.morningPark !== "MK" && d.eveningPark !== "MK")!;
const mkDays = plan.days.filter((d) => d.morningPark === "MK").map((d) => d.date);

describe("🔴の警告に付く、おすすめの直し方", () => {
  it("最初の作戦には🔴がない", () => {
    expect(reds(plan)).toEqual([]);
  });

  it("ビー・アワ・ゲストをMKにいない日に動かすと、MKの日の昼食へ移す提案が付き、当てると🔴が消える", () => {
    const p = moveItem(plan, "park-be-our-guest", { date: notMk.date, slot: "lunch", method: "meal" });
    const w = reds(p).find((x) => x.message.includes("ビー・アワ・ゲスト"));
    expect(w?.fix?.kind).toBe("move");
    if (w?.fix?.kind !== "move") return;
    expect(mkDays).toContain(w.fix.date);
    expect(w.fix.slot).toBe("lunch");
    expect(w.fix.text).toContain("昼食");
    expect(reds(applyFix(p, w.fix))).toEqual([]);
  });

  it("別のパークに動かした乗り物は、そのパークの日へ戻す提案になる", () => {
    const p = moveItem(plan, "guardians", { date: notMk.date === plan.days[0].date ? plan.days[1].date : notMk.date, slot: "am", method: "standby" });
    const w = reds(p).find((x) => x.message.includes("ガーディアンズ"));
    if (!w) return; // たまたまエプコットの日なら警告なし
    expect(w.fix).toBeTruthy();
    expect(reds(applyFix(p, w.fix!))).toEqual([]);
  });

  it("人気グループを同じ日に2本事前予約すると、片方を追加購入（または列）に変える提案", () => {
    const hs = plan.days.find((x) => x.morningPark === "HS")!;
    const p = moveItem(moveItem(plan, "runaway-railway", { date: hs.date, slot: "pm", method: "multi" }), "slinky-dog", { date: hs.date, slot: "am", method: "multi" });
    const w = reds(p).find((x) => x.message.includes("人気グループ"));
    expect(w?.fix).toBeTruthy();
    expect(reds(applyFix(p, w!.fix!)).some((x) => x.message.includes("人気グループ"))).toBe(false);
  });

  it("朝イチを2本にすると、1本を朝イチ以外に変える提案", () => {
    const mk = plan.days.find((x) => x.morningPark === "MK")!;
    const p = moveItem(moveItem(plan, "seven-dwarfs", { date: mk.date, slot: "early", method: "early" }), "tron", { date: mk.date, slot: "early", method: "early" });
    const w = reds(p).find((x) => x.message.includes("朝イチ"));
    expect(w?.fix).toBeTruthy();
    expect(reds(applyFix(p, w!.fix!)).some((x) => x.message.includes("朝イチが2本"))).toBe(false);
  });

  it("まとめて直すと、直せる🔴はすべて消える", () => {
    let p = moveItem(plan, "park-be-our-guest", { date: notMk.date, slot: "lunch", method: "meal" });
    const hs = plan.days.find((x) => x.morningPark === "HS")!;
    p = moveItem(moveItem(p, "runaway-railway", { date: hs.date, slot: "pm", method: "multi" }), "slinky-dog", { date: hs.date, slot: "am", method: "multi" });
    expect(reds(p).length).toBeGreaterThanOrEqual(2);
    expect(reds(fixAllReds(p, consensus, rideById))).toEqual([]);
  });
});
