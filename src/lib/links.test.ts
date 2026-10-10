import { describe, expect, it } from "vitest";
import { RIDES } from "../data/rides";
import { rideLinks } from "./links";

describe("アトラクションのリンク", () => {
  it("全アトラクションに、動画・日本語・公式の3つのリンクがあり、名前が正しく埋め込まれる", () => {
    for (const r of RIDES) {
      const links = rideLinks(r);
      expect(links.map((l) => l.label)).toEqual(["動画で見る", "日本語で調べる", "公式サイト"]);
      for (const l of links) expect(() => new URL(l.url)).not.toThrow();
      expect(decodeURIComponent(links[0]?.url ?? "")).toContain(r.nameEn);
    }
  });

  it("アポストロフィや＆を含む名前も壊れない", () => {
    const r = RIDES.find((x) => x.id === "runaway-railway");
    expect(r).toBeDefined();
    if (!r) return;
    const url = new URL(rideLinks(r)[0]?.url ?? "");
    expect(url.searchParams.get("search_query")).toContain("Mickey & Minnie's Runaway Railway");
  });
});
