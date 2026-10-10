import { describe, expect, it } from "vitest";
import { RIDES, rideById } from "../data/rides";
import { accessLines } from "./access";

const valueOf = (id: string, label: string): string | undefined => {
  const r = rideById(id);
  return r ? accessLines(r).find((l) => l.label === label)?.value : undefined;
};

describe("チケット・パスの説明", () => {
  it("全件に入園チケットと時短パスの行がある", () => {
    for (const r of RIDES) {
      const labels = accessLines(r).map((l) => l.label);
      expect(labels).toContain("入園チケット");
      expect(labels).toContain("時短パス");
    }
  });

  it("Single Pass・人気グループ・パスなしを書き分ける", () => {
    expect(valueOf("flight-of-passage", "時短パス")).toContain("Single Pass");
    expect(valueOf("slinky-dog", "時短パス")).toContain("人気グループ");
    expect(valueOf("everest", "時短パス")).toContain("Multi Pass");
    expect(valueOf("fantasmic", "時短パス")).toContain("なし");
  });

  it("開園前入園は乗り物だけに表示し、トロンは対象外", () => {
    expect(valueOf("tron", "開園前入園")).toContain("対象外");
    expect(valueOf("flight-of-passage", "開園前入園")).toContain("対象（");
    expect(valueOf("lion-king", "開園前入園")).toBeUndefined();
  });
});
