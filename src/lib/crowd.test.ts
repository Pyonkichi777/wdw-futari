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

describe("public/crowd.json（Magic Tips から取り込んだ値）", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const { parseCrowdFeed } = await import("./crowd");
  const { TRIP } = await import("../data/trip");
  it.runIf(existsSync("public/crowd.json"))("壊れておらず、5日間×4パークの値がそろい、出典は https", () => {
    const feed = parseCrowdFeed(JSON.parse(readFileSync("public/crowd.json", "utf-8")));
    expect(feed).not.toBeNull();
    expect(feed!.source.url.startsWith("https://")).toBe(true);
    for (const d of TRIP.parkDays) for (const p of ["MK", "EP", "HS", "AK"] as const) expect(feed!.days[d]?.[p]).toBeTypeOf("number");
  });
  it("Magic Tips の区分（<36 静か／36–50 ふつう／51–75 混む／>75 とても混む）どおりに段階を付ける", () => {
    const feed = parseCrowdFeed({ source: { name: "Magic Tips", url: "https://magic-tips.app/" }, scale: 100, bands: [36, 51, 76], days: { "2027-05-01": { MK: 35, EP: 50, HS: 75, AK: 76 } } })!;
    expect(["MK", "EP", "HS", "AK"].map((p) => crowdInfo(p as "MK", "2027-05-01", feed).level)).toEqual(["low", "mid", "high", "peak"]);
  });
});
