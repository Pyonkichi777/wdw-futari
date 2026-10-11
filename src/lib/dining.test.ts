import { describe, expect, it } from "vitest";
import { DINING } from "../data/dining";
import { RIDES } from "../data/rides";
import { bookingOpensJst, filterDining } from "./dining";

const ALL = { type: "ALL", area: "ALL", meal: "ALL", q: "" } as const;

describe("キャラクターダイニング", () => {
  it("idが重ならず、公式ページのパスがあり、どれも投票の対象", () => {
    expect(new Set(DINING.map((d) => d.id)).size).toBe(DINING.length);
    for (const d of DINING) {
      expect(d.officialPath).toMatch(/^\/dining\/[a-z0-9-]+\/[a-z0-9-]+\/$/);
      expect(d.kind).toBe("dining");
      expect(d.dining?.meals.length).toBeGreaterThan(0);
      expect(RIDES).toContain(d);
    }
  });

  it("予約開始: 4/30チェックインなら3/1の朝6時（米東部・標準時間）＝日本時間20時", () => {
    expect(bookingOpensJst("2027-04-30")).toBe("2027年3月1日(月) 20:00");
  });

  it("予約開始: 夏時間の時期は日本時間19時になる", () => {
    // 2027-07-10 の60日前 = 5/11（夏時間）
    expect(bookingOpensJst("2027-07-10")).toBe("2027年5月11日(火) 19:00");
  });

  it("パーク内／ホテルで分けられる（パーク内は入園チケットが必要）", () => {
    const park = filterDining(DINING, { ...ALL, area: "park" });
    const resort = filterDining(DINING, { ...ALL, area: "resort" });
    expect(park.length + resort.length).toBe(DINING.length);
    expect(park.every((d) => d.dining?.inPark)).toBe(true);
    expect(resort.every((d) => d.dining?.inPark === false)).toBe(true);
  });

  it("食事の時間帯とキャラクター名で探せる", () => {
    expect(filterDining(DINING, { ...ALL, meal: "dinner", q: "白雪姫" }).map((d) => d.id)).toEqual(["dine-akershus", "dine-artist-point"]);
    expect(filterDining(DINING, { ...ALL, q: "女王" }).map((d) => d.id)).toEqual(["dine-artist-point"]);
    expect(filterDining(DINING, { ...ALL, q: "すてぃっち" }).map((d) => d.id)).toEqual(["dine-ohana"]);
    expect(filterDining(DINING, { ...ALL, q: "ぷーさん" }).map((d) => d.id)).toEqual(["dine-crystal-palace"]);
  });

  it("キャラクターに会える店／ふつうのレストランで分けられ、ホテルの店も朝・昼・夜を持つ", () => {
    const chara = filterDining(DINING, { ...ALL, type: "character" });
    const plain = filterDining(DINING, { ...ALL, type: "plain" });
    expect(chara.length + plain.length).toBe(DINING.length);
    expect(chara.every((d) => d.dining?.characters)).toBe(true);
    expect(plain.every((d) => d.dining?.characters === null)).toBe(true);
    expect(plain.map((d) => d.id)).toContain("park-space-220");
    expect(plain.find((d) => d.id === "hotel-kona-cafe")?.dining?.meals).toEqual(["breakfast", "lunch", "dinner"]);
  });

  it("泊まるホテルのフードコートは予約なし、料理で検索できる", () => {
    expect(filterDining(DINING, { ...ALL, q: "ポップセンチュリー" }).map((d) => d.dining?.booking)).toContain("none");
    expect(filterDining(DINING, { ...ALL, q: "すてーき" }).map((d) => d.id)).toContain("hotel-yachtsman");
    expect(filterDining(DINING, { ...ALL, q: "space 220" }).map((d) => d.id)).toEqual(["park-space-220", "park-space-220-lounge"]);
  });
});
