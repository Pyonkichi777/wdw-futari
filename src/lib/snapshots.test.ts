import { describe, expect, it } from "vitest";
import { emptyPlan } from "./plan";
import { MAX_SNAPSHOTS, addSnapshot, parseSnapshots, removeSnapshot, toStored, type PlanSnapshot } from "./snapshots";

const snap = (id: string, by: "toshi" | "tsuma", savedAt: number): PlanSnapshot => ({ id, by, savedAt, name: id, plan: { ...emptyPlan(), days: [{ date: "2027-05-01", morningPark: "AK", eveningPark: "EP", items: [{ rideId: "flight-of-passage", slot: "early", method: "early" }] }] } });

describe("作戦の保存（2人合計10件まで）", () => {
  it("保存して読み直すと同じ（新しい順）", () => {
    const list = [snap("a", "toshi", 1), snap("b", "tsuma", 2)];
    const back = parseSnapshots(JSON.parse(JSON.stringify(toStored(list))));
    expect(back.map((s) => s.id)).toEqual(["b", "a"]);
    expect(back[1]?.plan.days[0]?.items[0]?.rideId).toBe("flight-of-passage");
  });
  it("10件まで。いっぱいなら入れ替えを選んだときだけ、自分のいちばん古い保存と入れ替える（相手のは消さない）", () => {
    const list = Array.from({ length: MAX_SNAPSHOTS }, (_, i) => snap(`s${i}`, i < 3 ? "toshi" : "tsuma", 100 + i));
    expect(addSnapshot(list, snap("new", "toshi", 999), false)).toEqual({ ok: false, reason: "full" });
    const r = addSnapshot(list, snap("new", "toshi", 999), true);
    expect(r.ok && r.removed?.id).toBe("s0");
    expect(r.ok && r.list.length).toBe(MAX_SNAPSHOTS);
    const onlyPartner = Array.from({ length: MAX_SNAPSHOTS }, (_, i) => snap(`t${i}`, "tsuma", i));
    expect(addSnapshot(onlyPartner, snap("new", "toshi", 999), true).ok).toBe(false);
  });
  it("削除できるのは本人の保存だけ", () => {
    const list = [snap("a", "toshi", 1), snap("b", "tsuma", 2)];
    expect(removeSnapshot(list, "b", "toshi").map((s) => s.id)).toEqual(["a", "b"]);
    expect(removeSnapshot(list, "b", "tsuma").map((s) => s.id)).toEqual(["a"]);
  });
});
