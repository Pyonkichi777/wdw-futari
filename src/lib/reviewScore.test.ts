import { describe, expect, it } from "vitest";
import { RIDES } from "../data/rides";
import { REVIEWS } from "../data/reviews";
import { scoreOf, verdictOf } from "./reviewScore";

describe("口コミの数値化", () => {
  it("★から総評の段階を決める", () => {
    expect(verdictOf(4.8)).toBe("絶賛");
    expect(verdictOf(4.3)).toBe("高評価");
    expect(verdictOf(3.9)).toBe("好評");
    expect(verdictOf(3.5)).toBe("賛否両論");
    expect(verdictOf(2.8)).toBe("低評価");
  });

  it("高評価率は「とても良い」+「良い」の割合", () => {
    const s = scoreOf({ rating: 4.7, count: 439, breakdown: [320, 106, 9, 0, 4], url: "https://example.com", summary: "" });
    expect(s.positivePct).toBe(97);
    expect(s.lowConfidence).toBe(false);
  });

  it("件数が少ないものは参考値、ごく少ないものは★を出さない", () => {
    expect(scoreOf({ rating: 4.0, count: 11, breakdown: [6, 3, 0, 0, 2], url: "https://example.com", summary: "" }).lowConfidence).toBe(true);
    const one = scoreOf({ rating: 4.0, count: 1, breakdown: null, url: "https://example.com", summary: "" });
    expect(one.rating).toBeNull();
    expect(one.verdict).toBeNull();
  });

  it("口コミデータは実在するアトラクションに紐づき、内訳の合計が件数と一致する", () => {
    const ids = new Set(RIDES.map((r) => r.id));
    for (const [id, r] of Object.entries(REVIEWS)) {
      expect(ids.has(id)).toBe(true);
      expect(r.url).toMatch(/^https:\/\/www\.tripadvisor\.com\/Attraction_Review-/);
      if (r.breakdown && r.count !== null) expect(r.breakdown.reduce((a, b) => a + b, 0)).toBe(r.count);
    }
  });
});
