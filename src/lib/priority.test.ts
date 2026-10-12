import { describe, expect, it } from "vitest";
import { isLowPriority } from "./priority";
import { removeItems, type Plan } from "./plan";

describe("優先度の低いもの", () => {
  const votes = { toshi: { a: "either", b: "either", c: "must" }, tsuma: { a: "either", b: "want", c: "either" } } as const;
  it("2人とも「どちらでも」だけが優先度低", () => {
    expect(isLowPriority(votes, "a")).toBe(true);
    expect(isLowPriority(votes, "b")).toBe(false);
    expect(isLowPriority(votes, "c")).toBe(false);
  });
  it("まとめて外す（日を指定すればその日だけ）", () => {
    const plan: Plan = {
      updatedBy: null,
      updatedAt: null,
      days: [
        { date: "d1", morningPark: "MK", eveningPark: "MK", items: [{ rideId: "a", slot: "am", method: "standby" }, { rideId: "c", slot: "am", method: "standby" }] },
        { date: "d2", morningPark: "EP", eveningPark: "EP", items: [{ rideId: "a", slot: "pm", method: "standby" }] },
      ],
    };
    const one = removeItems(plan, new Set(["a"]), "d1");
    expect(one.days[0]?.items.map((i) => i.rideId)).toEqual(["c"]);
    expect(one.days[1]?.items.length).toBe(1);
    const all = removeItems(plan, new Set(["a"]));
    expect(all.days.flatMap((d) => d.items).map((i) => i.rideId)).toEqual(["c"]);
  });
});

describe("外したものの記録と復活", () => {
  const base: Plan = {
    updatedBy: null,
    updatedAt: null,
    days: [
      { date: "2027-05-01", morningPark: "EP", eveningPark: "EP", items: [{ rideId: "soarin", slot: "pm", method: "multi" }, { rideId: "remy", slot: "am", method: "multi" }] },
      { date: "2027-05-02", morningPark: "HS", eveningPark: "HS", items: [{ rideId: "toy-story-mania", slot: "am", method: "standby" }] },
    ],
  };
  it("外すと、どこにあったか・誰が外したかが記録される", async () => {
    const { removeItem } = await import("./plan");
    const p = removeItem(base, "soarin", "tsuma");
    expect(p.days[0]?.items.map((i) => i.rideId)).toEqual(["remy"]);
    expect(p.excluded).toEqual([expect.objectContaining({ rideId: "soarin", date: "2027-05-01", slot: "pm", method: "multi", by: "tsuma" })]);
  });
  it("復活すると元の日・時間・乗り方に戻り、記録から消える", async () => {
    const { removeItem, restoreItem } = await import("./plan");
    const p = restoreItem(removeItem(base, "soarin", "toshi"), "soarin");
    expect(p.days[0]?.items.find((i) => i.rideId === "soarin")).toEqual({ rideId: "soarin", slot: "pm", method: "multi" });
    expect(p.excluded).toBeUndefined();
  });
  it("保存して読み直しても残る（2人で共有される）", async () => {
    const { removeItems, parsePlan } = await import("./plan");
    const p = removeItems(base, new Set(["soarin", "toy-story-mania"]), undefined, "toshi");
    const again = parsePlan(JSON.parse(JSON.stringify(p)));
    expect(again.excluded?.map((e) => e.rideId).sort()).toEqual(["soarin", "toy-story-mania"]);
  });
  it("作り直しても、外したものは入れない（記録も引き継ぐ）", async () => {
    const { buildPlan, removeItem, unplaced } = await import("./plan");
    const { rideById } = await import("../data/rides");
    const consensus = [
      { rideId: "soarin", rank: "B" as const },
      { rideId: "remy", rank: "A" as const },
    ];
    const ex = removeItem(base, "soarin", "toshi").excluded;
    const p = buildPlan(consensus, rideById, ["2027-05-01", "2027-05-02", "2027-05-03", "2027-05-04", "2027-05-05"], { excluded: ex });
    expect(p.days.some((d) => d.items.some((i) => i.rideId === "soarin"))).toBe(false);
    expect(p.excluded?.map((e) => e.rideId)).toEqual(["soarin"]);
    expect(unplaced(p, consensus).map((c) => c.rideId)).toEqual([]);
  });
});

describe("戻す先のパーク", () => {
  it("元の日のパークが変わっていたら、同じパークの日に戻す", async () => {
    const { restoreItem } = await import("./plan");
    const { rideById } = await import("../data/rides");
    const plan: Plan = {
      updatedBy: null,
      updatedAt: null,
      excluded: [{ rideId: "soarin", date: "2027-05-01", slot: "pm", method: "multi", by: "toshi", at: 1 }],
      days: [
        { date: "2027-05-01", morningPark: "HS", eveningPark: "HS", items: [] },
        { date: "2027-05-02", morningPark: "EP", eveningPark: "EP", items: [] },
      ],
    };
    const p = restoreItem(plan, "soarin", (id) => rideById(id)?.park);
    expect(p.days[1]?.items.map((i) => i.rideId)).toEqual(["soarin"]);
    expect(p.days[0]?.items).toEqual([]);
  });
});
