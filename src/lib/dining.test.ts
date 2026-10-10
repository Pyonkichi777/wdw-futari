import { describe, expect, it } from "vitest";
import { DINING } from "../data/dining";
import { bookingOpensJst, filterDining } from "./dining";

const ALL = { area: "ALL", meal: "ALL", q: "" } as const;

describe("キャラクターダイニング", () => {
  it("idが重ならず、公式ページのパスがある", () => {
    expect(new Set(DINING.map((d) => d.id)).size).toBe(DINING.length);
    for (const d of DINING) expect(d.officialPath).toMatch(/^\/dining\/[a-z0-9-]+\/[a-z0-9-]+\/$/);
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
    expect(park.every((d) => d.needsAdmission)).toBe(true);
    expect(resort.every((d) => !d.needsAdmission)).toBe(true);
  });

  it("食事の時間帯とキャラクター名で探せる", () => {
    expect(filterDining(DINING, { ...ALL, meal: "dinner", q: "白雪姫" }).map((d) => d.id)).toEqual(["dine-akershus", "dine-artist-point"]);
    expect(filterDining(DINING, { ...ALL, q: "女王" }).map((d) => d.id)).toEqual(["dine-artist-point"]);
    expect(filterDining(DINING, { ...ALL, q: "すてぃっち" }).map((d) => d.id)).toEqual(["dine-ohana"]);
    expect(filterDining(DINING, { ...ALL, q: "ぷーさん" }).map((d) => d.id)).toEqual(["dine-crystal-palace"]);
  });
});
