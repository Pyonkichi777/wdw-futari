import { describe, expect, it } from "vitest";
import { RIDES, rideById } from "../data/rides";
import { llKind } from "./lightningLane";

describe("時短パスの区分（2026-10-12 公式サイトで確認）", () => {
  it("Single Pass専用は5つ（アバターもここ。Multi Passでは乗れない）", () => {
    const ids = RIDES.filter((r) => llKind(r) === "singleOnly").map((r) => r.id).sort();
    expect(ids).toEqual(["flight-of-passage", "guardians", "rise-of-the-resistance", "seven-dwarfs", "tron"]);
  });
  it("アニマルキングダムには人気グループがない", () => {
    expect(llKind(rideById("everest")!)).toBe("multi");
    expect(llKind(rideById("slinky-dog")!)).toBe("multiTier1");
    expect(llKind(rideById("pirates")!)).toBe("multi");
  });
});
