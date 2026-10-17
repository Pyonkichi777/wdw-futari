import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RIDES, rideById } from "../data/rides";
import { newsForRide, parseFeed, sortNews, type NewsItem } from "./news";

const item = (over: Partial<NewsItem>): NewsItem => ({
  id: "x",
  publishedAt: "2026-10-10",
  title: "t",
  summary: "s",
  impact: "low",
  category: "ride",
  rideIds: [],
  period: null,
  overlapsTrip: "maybe",
  action: "",
  sources: [],
  ...over,
});

describe("ニュース", () => {
  it("public/news.json が読めて、壊れた項目がなく、出典はhttpsで、rideIdsは図鑑に実在する", () => {
    const raw: unknown = JSON.parse(readFileSync("public/news.json", "utf-8"));
    const feed = parseFeed(raw);
    const rawItems = (raw as { items: unknown[] }).items;
    expect(feed.items).toHaveLength(rawItems.length);
    const ids = new Set(RIDES.map((r) => r.id));
    for (const n of feed.items) {
      expect(n.sources.length).toBeGreaterThan(0);
      for (const id of n.rideIds) expect(ids.has(id)).toBe(true);
    }
    expect(new Set(feed.items.map((n) => n.id)).size).toBe(feed.items.length);
  });

  it("重要度 → 旅行への影響 → 新しい順に並べる", () => {
    const sorted = sortNews([
      item({ id: "a", impact: "low", overlapsTrip: "yes" }),
      item({ id: "b", impact: "high", overlapsTrip: "no" }),
      item({ id: "c", impact: "low", overlapsTrip: "yes", publishedAt: "2026-12-01" }),
    ]);
    expect(sorted.map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("壊れた項目と https 以外の出典は捨てる", () => {
    const feed = parseFeed({ items: [{ id: "x" }, { ...item({ id: "ok" }), sources: [{ title: "a", url: "javascript:alert(1)" }] }] });
    expect(feed.items.map((n) => n.id)).toEqual(["ok"]);
    expect(feed.items[0]?.sources).toEqual([]);
  });

  it("アトラクションのカード用: 旅行期間外のニュースは出さない", () => {
    const r = rideById("everest");
    expect(r).toBeDefined();
    if (!r) return;
    const list = [item({ id: "in", rideIds: ["everest"], overlapsTrip: "yes" }), item({ id: "out", rideIds: ["everest"], overlapsTrip: "no" })];
    expect(newsForRide(r, list).map((n) => n.id)).toEqual(["in"]);
  });
});

describe("ニュースの文章に作戦の日付を書かない（作戦は変わるため。今の作戦との関係はアプリが表示する）", () => {
  it("action に旅行中の日付（4/29〜5/7）を書かない", async () => {
    const { readFileSync } = await import("node:fs");
    const raw = JSON.parse(readFileSync("public/news.json", "utf-8")) as { items: { id: string; action: string }[] };
    for (const n of raw.items) expect(n.action, n.id).not.toMatch(/(4\/(29|30)|5\/[1-7])(?!\d)/);
  });
});
