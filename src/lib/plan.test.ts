import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import { TRIP } from "../data/trip";
import type { ConsensusItem } from "../types";
import { buildPlan, chooseParkOrder, moveItem, needsMultiPass, unplaced } from "./plan";
import { checkPlan } from "./planChecks";

const S = (rideId: string, meal?: ConsensusItem["meal"]): ConsensusItem => (meal ? { rideId, rank: "S", meal } : { rideId, rank: "S" });
const A = (rideId: string, meal?: ConsensusItem["meal"]): ConsensusItem => (meal ? { rideId, rank: "A", meal } : { rideId, rank: "A" });
const B = (rideId: string): ConsensusItem => ({ rideId, rank: "B" });

const consensus: ConsensusItem[] = [
  S("flight-of-passage"),
  S("rise-of-the-resistance"),
  S("guardians"),
  S("tron"),
  S("slinky-dog"),
  S("everest"),
  A("test-track"),
  A("kilimanjaro"),
  A("runaway-railway"),
  A("remy"),
  A("space-mountain"),
  A("big-thunder"),
  A("tiana"),
  B("tower-of-terror"),
  A("happily-ever-after"),
  A("luminous"),
  S("dine-crystal-palace", "dinner"),
  A("dine-topolino", "breakfast"),
];
const plan = buildPlan(consensus, rideById, TRIP.parkDays);
const dayOf = (id: string) => plan.days.find((d) => d.items.some((i) => i.rideId === id));
const itemOf = (id: string) => dayOf(id)?.items.find((i) => i.rideId === id);

describe("作戦の自動作成", () => {
  it("5日分を作り、4パークを1日ずつ＋予備日", () => {
    expect(plan.days.map((d) => d.date)).toEqual([...TRIP.parkDays]);
    expect(new Set(plan.days.slice(0, 4).map((d) => d.morningPark)).size).toBe(4);
  });

  it("ハリウッド・スタジオはスター・ウォーズの日（5/4）を避ける", () => {
    expect(plan.days.find((d) => d.date === "2027-05-04")?.morningPark).not.toBe("HS");
  });

  it("混むパークほど週末を避ける（全部同じ重さなら、土曜はAK。エプコットはフラワー＆ガーデンの週末を避け、スタジオは5/4を避ける）", () => {
    const order = chooseParkOrder([], TRIP.parkDays);
    expect(order[0]).toBe("AK");
    expect(order.slice(0, 2)).not.toContain("EP");
    expect(order.slice(0, 2)).not.toContain("MK");
    expect(order[3]).not.toBe("HS");
  });

  it("アニマルキングダムの日は夕方エプコットへ", () => {
    const ak = plan.days.find((d) => d.morningPark === "AK" && d.date !== TRIP.parkDays[4]);
    expect(ak?.eveningPark).toBe("EP");
  });

  it("各日の朝イチは1本で、開園前入園できるSの乗り物", () => {
    for (const d of plan.days.slice(0, 4)) {
      const early = d.items.filter((i) => i.method === "early");
      expect(early.length).toBeLessThanOrEqual(1);
      for (const e of early) expect(rideById(e.rideId)?.earlyEntry).toBe(true);
    }
    expect(itemOf("flight-of-passage")?.method).toBe("early");
    expect(itemOf("rise-of-the-resistance")?.method).toBe("early");
  });

  it("トロンは開園前入園の対象外なので Single Pass", () => {
    expect(itemOf("tron")?.method).toBe("single");
  });

  it("人気グループのMulti Pass事前予約は1日1本まで、残りは追加予約か1人乗り列", () => {
    for (const d of plan.days) {
      const tier1 = d.items.filter((i) => i.method === "multi" && rideById(i.rideId)?.multiPassTier === 1 && rideById(i.rideId)?.park !== "AK");
      expect(tier1.length).toBeLessThanOrEqual(1);
    }
    expect(["multi", "singleRider", "early"]).toContain(itemOf("test-track")?.method);
  });

  it("夜の花火は夕方以降にいるパークの日の夜に入る", () => {
    const d = dayOf("happily-ever-after");
    expect(d?.eveningPark).toBe("MK");
    expect(itemOf("happily-ever-after")?.slot).toBe("night");
  });

  it("レストランは決めた時間帯に、その時間にいるパークの日に入る", () => {
    expect(dayOf("dine-crystal-palace")?.eveningPark).toBe("MK");
    expect(itemOf("dine-crystal-palace")?.slot).toBe("dinner");
    expect(dayOf("dine-topolino")?.morningPark).toBe("EP");
    expect(itemOf("dine-topolino")?.slot).toBe("am");
  });

  it("合意リストにパレードがなくても、マジックキングダムの日に昼のパレードをおすすめで足す", () => {
    const fof = itemOf("festival-of-fantasy");
    expect(dayOf("festival-of-fantasy")?.morningPark).toBe("MK");
    expect(fof?.suggested).toBe(true);
  });

  it("Sはすべてどこかの日に入り、赤い警告が出ない", () => {
    expect(unplaced(plan, consensus).filter((c) => c.rank === "S")).toEqual([]);
    expect(checkPlan(plan, consensus, rideById).filter((w) => w.level === "red")).toEqual([]);
  });

  it("Multi Passを使う日が分かる", () => {
    expect(plan.days.some(needsMultiPass)).toBe(true);
  });
});

describe("作戦の自動チェック", () => {
  it("朝イチを2本にすると赤、開園前入園の対象外を朝イチにしても赤", () => {
    const d = plan.days.find((x) => x.morningPark === "MK")!;
    const p = moveItem(plan, "tron", { date: d.date, slot: "early", method: "early" });
    const w = checkPlan(p, consensus, rideById).filter((x) => x.level === "red").map((x) => x.message);
    expect(w.some((m) => m.includes("朝イチが2本") || m.includes("開園前入園の対象外"))).toBe(true);
  });

  it("別のパークの日に動かすと赤", () => {
    const hs = plan.days.find((x) => x.morningPark === "HS")!;
    const p = moveItem(plan, "everest", { date: hs.date, slot: "am", method: "standby" });
    expect(checkPlan(p, consensus, rideById).some((x) => x.level === "red" && x.message.includes("エクスペディション・エベレスト"))).toBe(true);
  });

  it("人気グループを同じ日に2本事前予約すると赤", () => {
    const hs = plan.days.find((x) => x.morningPark === "HS")!;
    const p = moveItem(plan, "runaway-railway", { date: hs.date, slot: "pm", method: "multi" });
    const p2 = moveItem(p, "slinky-dog", { date: hs.date, slot: "am", method: "multi" });
    expect(checkPlan(p2, consensus, rideById).some((x) => x.level === "red" && x.message.includes("人気グループ"))).toBe(true);
  });

  it("Sを外すと赤", () => {
    const p = { ...plan, days: plan.days.map((d) => ({ ...d, items: d.items.filter((i) => i.rideId !== "guardians") })) };
    expect(checkPlan(p, consensus, rideById).some((x) => x.level === "red" && x.message.includes("ガーディアンズ"))).toBe(true);
  });
});

describe("作戦の保存データ", () => {
  it("保存して読み直すと同じ", async () => {
    const { parsePlan } = await import("./plan");
    expect(parsePlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });
  it("壊れた項目は捨てる", async () => {
    const { parsePlan } = await import("./plan");
    const p = parsePlan({ days: [{ date: "2027-05-01", morningPark: "XX", eveningPark: "MK", items: [] }, { date: "2027-05-02", morningPark: "EP", eveningPark: "EP", items: [{ rideId: "remy", slot: "zzz", method: "multi" }, { rideId: "remy", slot: "am", method: "multi" }] }] });
    expect(p.days).toEqual([{ date: "2027-05-02", morningPark: "EP", eveningPark: "EP", items: [{ rideId: "remy", slot: "am", method: "multi" }] }]);
  });
});

describe("本命パーク", () => {
  it("本命をアニマルキングダムにすると、4日のうちいちばん空いている平日（5/4 火）に置く", () => {
    const p = buildPlan(consensus, rideById, TRIP.parkDays, { focusParks: ["AK"] });
    expect(p.days.find((d) => d.morningPark === "AK" && d.date !== "2027-05-05")?.date).toBe("2027-05-04");
    expect(p.days.find((d) => d.date === "2027-05-04")?.morningPark).not.toBe("HS");
    expect(p.focusParks).toEqual(["AK"]);
    expect(itemOfIn(p, "flight-of-passage")?.method).toBe("early");
  });
  it("予備日は、残りが同じなら本命パークになる", () => {
    const p = buildPlan(consensus, rideById, TRIP.parkDays, { focusParks: ["AK"] });
    expect(p.days[4]?.morningPark).toBe("AK");
  });
  it("第1〜第4優先: 上の優先ほど混雑予想の低い日になる", async () => {
    const { crowdScore } = await import("./crowd");
    const order = ["MK", "HS", "EP", "AK"] as const;
    const p = buildPlan(consensus, rideById, TRIP.parkDays, { focusParks: [...order] });
    const scoreOf = (park: (typeof order)[number]) => {
      const d = p.days.slice(0, 4).find((x) => x.morningPark === park)!;
      return crowdScore(park, d.date);
    };
    expect(scoreOf("MK")).toBeLessThanOrEqual(scoreOf("HS"));
    expect(p.focusParks).toEqual([...order]);
  });
  it("以前の保存形式（本命1つ）も読める", async () => {
    const { parsePlan } = await import("./plan");
    expect(parsePlan({ days: [], focusPark: "EP" }).focusParks).toEqual(["EP"]);
    expect(parsePlan({ days: [], focusParks: ["HS", "HS", "XX", "MK"] }).focusParks).toEqual(["HS", "MK"]);
  });
});

function itemOfIn(p: ReturnType<typeof buildPlan>, id: string) {
  return p.days.flatMap((d) => d.items).find((i) => i.rideId === id);
}
