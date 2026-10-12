import { describe, expect, it } from "vitest";
import { crowdInfo } from "./crowd";

describe("混雑予想", () => {
  it("土曜のマジックキングダムはとても混む、水曜のアニマルキングダムは空き気味", () => {
    expect(crowdInfo("MK", "2027-05-01").level).toBe("peak");
    expect(crowdInfo("AK", "2027-05-05").level).toBe("low");
  });
  it("エプコットはフラワー＆ガーデンの週末に混む、5/4のスタジオはスター・ウォーズの日", () => {
    expect(crowdInfo("EP", "2027-05-02").reasons.join()).toContain("フラワー＆ガーデン");
    expect(crowdInfo("EP", "2027-05-03").reasons.join()).not.toContain("フラワー＆ガーデン");
    expect(crowdInfo("HS", "2027-05-04").level).toBe("peak");
  });
});

describe("混雑予想サイトの値（crowd.json）", async () => {
  const { parseCrowdFeed } = await import("./crowd");
  const { chooseParkOrder } = await import("./plan");
  const { TRIP } = await import("../data/trip");
  const feed = parseCrowdFeed({
    source: { name: "テスト予想", url: "https://example.com/crowd" },
    fetchedAt: "2026-10-13",
    method: "予想混雑度（1〜10）",
    days: { "2027-05-01": { MK: 2, EP: 9, HS: 9, AK: 9, XX: 3 }, "2027-05-02": { MK: 10, EP: 1 }, bad: { MK: 1 }, "2027-05-03": { MK: 0 } },
  });
  it("壊れた値は捨て、https の出典がないものは使わない", () => {
    expect(feed?.days).toEqual({ "2027-05-01": { MK: 2, EP: 9, HS: 9, AK: 9 }, "2027-05-02": { MK: 10, EP: 1 } });
    expect(parseCrowdFeed({ source: { name: "x", url: "http://x" }, days: { "2027-05-01": { MK: 1 } } })).toBeNull();
  });
  it("値がある日・パークはサイトの値、ないところは推定", () => {
    expect(crowdInfo("MK", "2027-05-01", feed)).toMatchObject({ level: "low", basis: "data" });
    expect(crowdInfo("AK", "2027-05-05", feed).basis).toBe("estimate");
  });
  it("作戦を組むときもサイトの値を使う（土曜でも予想が空いていればマジックキングダム）", () => {
    const order = chooseParkOrder([], TRIP.parkDays, [], feed);
    expect(order[0]).toBe("MK");
  });
});
