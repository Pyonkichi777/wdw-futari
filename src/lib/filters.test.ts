import { describe, expect, it } from "vitest";
import { RIDES } from "../data/rides";
import { matchesFeatures, toggle, type FeatureId } from "./filters";

const pick = (...ids: FeatureId[]): string[] => RIDES.filter((r) => matchesFeatures(r, new Set(ids))).map((r) => r.id);

describe("絞り込み", () => {
  it("何も選ばなければ全件", () => {
    expect(pick()).toHaveLength(RIDES.length);
  });

  it("Single Pass は5件（公式サイトの対象と一致）", () => {
    expect(pick("single").sort()).toEqual(["flight-of-passage", "guardians", "rise-of-the-resistance", "seven-dwarfs", "tron"]);
  });

  it("複数選ぶと、すべてを満たすものだけ", () => {
    // Single Pass かつ 開園前入園OK → トロンは開園前入園の対象外なので入らない
    const r = pick("single", "early");
    expect(r).toContain("flight-of-passage");
    expect(r).not.toContain("tron");
  });

  it("TOP10は10件、口コミ★4.5以上にはフライト・オブ・パッセージが入りナヴィは入らない", () => {
    expect(pick("top10")).toHaveLength(10);
    expect(pick("review45")).toContain("flight-of-passage");
    expect(pick("review45")).not.toContain("navi-river");
  });

  it("toggle で付け外しできる", () => {
    const a = toggle(new Set<FeatureId>(), "top10");
    expect(a.has("top10")).toBe(true);
    expect(toggle(a, "top10").has("top10")).toBe(false);
  });
});
