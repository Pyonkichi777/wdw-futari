import { describe, expect, it } from "vitest";
import { RIDES } from "../data/rides";
import { rideLinks } from "./links";

describe("アトラクションのリンク", () => {
  it("全アトラクションに、動画・日本語・公式・口コミの4つのリンクがあり、名前が正しく埋め込まれる", () => {
    for (const r of RIDES) {
      const links = rideLinks(r);
      expect(links.map((l) => l.label)).toEqual(["動画で見る", "日本語で調べる", "公式サイト", "口コミを読む"]);
      for (const l of links) expect(() => new URL(l.url)).not.toThrow();
      expect(decodeURIComponent(links[0]?.url ?? "")).toContain(r.nameEn);
    }
  });

  it("公式サイトは公式ドメインの直接リンク", () => {
    for (const r of RIDES) {
      const official = rideLinks(r).find((l) => l.label === "公式サイト");
      expect(official?.url).toMatch(/^https:\/\/disneyworld\.disney\.go\.com\/(attractions|entertainment)\/[a-z-]+\/[a-z0-9-]+\/$/);
    }
  });

  it("Multi Passのグループは、Multi Passの対象にだけ付いている", () => {
    for (const r of RIDES) if (r.multiPassTier !== undefined) expect(r.lightningLane).toBe("multi");
  });

  it("アポストロフィや＆を含む名前も壊れない", () => {
    const r = RIDES.find((x) => x.id === "runaway-railway");
    expect(r).toBeDefined();
    if (!r) return;
    const url = new URL(rideLinks(r)[0]?.url ?? "");
    expect(url.searchParams.get("search_query")).toContain("Mickey & Minnie's Runaway Railway");
  });
});
