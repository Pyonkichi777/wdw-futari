import { describe, expect, it } from "vitest";
import type { NewsItem } from "./news";
import { unseenCount } from "./newsSeen";

const n = (id: string, impact: NewsItem["impact"], overlapsTrip: NewsItem["overlapsTrip"]): NewsItem => ({
  id,
  publishedAt: "2026-10-10",
  title: "",
  summary: "",
  impact,
  category: "ride",
  rideIds: [],
  period: null,
  overlapsTrip,
  action: "",
  sources: [],
});

describe("ニュースのバッジ", () => {
  const items = [n("a", "medium", "yes"), n("b", "high", "maybe"), n("c", "low", "yes"), n("d", "high", "no")];

  it("重要（要対応・注意）で旅行に関係するものだけ数える", () => {
    expect(unseenCount(items, new Set())).toBe(2);
  });

  it("既読にしたものは数えない。新しいニュースが来たらまた数える", () => {
    expect(unseenCount(items, new Set(["a", "b"]))).toBe(0);
    expect(unseenCount([...items, n("e", "medium", "yes")], new Set(["a", "b"]))).toBe(1);
  });
});
