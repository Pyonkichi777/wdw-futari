import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import { orderByRoute, walkKm } from "./route";
import { reservationTasks } from "./reservations";
import type { Plan, PlanItem } from "./plan";

const it_ = (rideId: string, slot: PlanItem["slot"], method: PlanItem["method"] = "standby"): PlanItem => ({ rideId, slot, method });

describe("動線（近い順）", () => {
  it("時間の枠は崩さず、枠の中を近い順に並べる", () => {
    // MK: 朝イチ=スペース・マウンテン（トゥモローランド）→ 午前に ピーターパン（ファンタジーランド）・バズ（トゥモローランド）・カリブの海賊（アドベンチャーランド）
    const items = [it_("space-mountain", "early", "early"), it_("pirates", "am"), it_("peter-pan", "am"), it_("buzz-lightyear", "am"), it_("happily-ever-after", "night", "show")];
    const ordered = orderByRoute(items).map((i) => i.rideId);
    expect(ordered[0]).toBe("space-mountain");
    expect(ordered[1]).toBe("buzz-lightyear"); // いちばん近い
    expect(ordered[ordered.length - 1]).toBe("happily-ever-after");
  });
  it("近い順に並べると歩く距離は短くなる（遠回りの順と比べて）", () => {
    const zigzag = [it_("space-mountain", "am"), it_("pirates", "am"), it_("buzz-lightyear", "am"), it_("big-thunder", "am")];
    const park = (id: string) => rideById(id)?.park;
    expect(walkKm(orderByRoute(zigzag), park)).toBeLessThan(walkKm(zigzag, park));
  });
});

describe("予約が必要なもの", () => {
  const plan: Plan = {
    updatedBy: null,
    updatedAt: null,
    days: [
      { date: "2027-05-03", morningPark: "HS", eveningPark: "HS", items: [it_("slinky-dog", "am", "multi"), it_("rise-of-the-resistance", "early", "early")] },
      { date: "2027-05-04", morningPark: "MK", eveningPark: "MK", items: [it_("tron", "am", "single"), it_("dine-crystal-palace", "dinner", "meal"), it_("hotel-everything-pop", "lunch", "meal")] },
    ],
  };
  const tasks = reservationTasks(plan, rideById);
  it("レストラン → Multi Pass → Single Pass の順。予約のいらない店は入らない", () => {
    expect(tasks.map((t) => t.kind)).toEqual(["dining", "multi", "single", "singleOptional"]);
    expect(tasks.some((t) => t.title.includes("エブリシング・ポップ"))).toBe(false);
  });
  it("予約開始日時: レストラン 3/1 20:00、時短パス 4/23 20:00（日本時間）", () => {
    expect(tasks[0]?.opens).toContain("2027年3月1日(月) 20:00");
    expect(tasks[1]?.opens).toContain("2027年4月23日(金) 20:00");
    expect(tasks[1]?.pick).toContain("★スリンキー");
  });
});

describe("1日を近い順に組み直す", () => {
  it("午前・午後をまたいだ行ったり来たりを減らし、ショーと食事の時間は動かさない", async () => {
    const { routeDay } = await import("./route");
    const day = {
      date: "2027-05-04",
      morningPark: "MK" as const,
      eveningPark: "MK" as const,
      items: [
        it_("space-mountain", "early", "early"),
        it_("pirates", "am"),
        it_("buzz-lightyear", "pm"),
        it_("jungle-cruise", "am"),
        it_("tron", "pm", "single"),
        it_("festival-of-fantasy", "pm", "show"),
        it_("dine-crystal-palace", "dinner", "meal"),
      ],
    };
    const park = (id: string) => rideById(id)?.park;
    const routed = routeDay(day);
    expect(walkKm(routed.items, park)).toBeLessThan(walkKm(day.items, park));
    expect(routed.items.find((i) => i.rideId === "festival-of-fantasy")?.slot).toBe("pm");
    expect(routed.items.find((i) => i.rideId === "dine-crystal-palace")?.slot).toBe("dinner");
    expect(routed.items[0]?.rideId).toBe("space-mountain");
    // トゥモローランドのものは午前に寄る
    expect(routed.items.find((i) => i.rideId === "buzz-lightyear")?.slot).toBe("am");
  });
});

describe("必須度と保険の Single Pass", () => {
  it("2人の回答から必須度を出す（複数ならいちばん強いもの）", async () => {
    const { necessityOf } = await import("./necessity");
    const votes = { toshi: { a: "must", b: "want" }, tsuma: { a: "must", b: "must" } } as const;
    expect(necessityOf(["a"], votes)).toBe("both");
    expect(necessityOf(["b"], votes)).toBe("one");
    expect(necessityOf(["c"], votes)).toBe("none");
    expect(necessityOf(["b", "a"], votes)).toBe("both");
  });
  it("朝イチの Single Pass 対象（アバター等）は、任意の保険として一覧に出る", () => {
    const plan: Plan = { updatedBy: null, updatedAt: null, days: [{ date: "2027-05-04", morningPark: "AK", eveningPark: "AK", items: [it_("flight-of-passage", "early", "early")] }] };
    const t = reservationTasks(plan, rideById);
    expect(t.map((x) => x.kind)).toEqual(["singleOptional"]);
    expect(t[0]?.title).toContain("任意");
  });
});
