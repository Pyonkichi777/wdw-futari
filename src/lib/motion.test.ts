import { describe, expect, it } from "vitest";
import { MOTION } from "../data/motion";
import { RIDES, rideById } from "../data/rides";
import { motionDots, motionOf } from "./motion";

describe("酔い度", () => {
  it("全アトラクションに酔い度がある（グリーティング・レストランは対象外で「なし」）", () => {
    for (const r of RIDES) {
      if (r.kind === "greet" || r.kind === "dining") expect(motionOf(r).level).toBe(0);
      else expect(MOTION[r.id]).toBeDefined();
    }
  });

  it("All Ears の評価を換算している（EXTREME=4、Low=1）", () => {
    const fop = rideById("flight-of-passage");
    const navi = rideById("navi-river");
    expect(fop && motionOf(fop)).toMatchObject({ level: 4, source: "allears", allEars: "EXTREME" });
    expect(navi && motionOf(navi)).toMatchObject({ level: 1, source: "allears" });
  });

  it("ショー・パレードは0", () => {
    const lk = rideById("lion-king");
    expect(lk && motionOf(lk).level).toBe(0);
  });

  it("●○で4段表示", () => {
    expect(motionDots(3)).toBe("●●●○");
    expect(motionDots(0)).toBe("○○○○");
  });
});
