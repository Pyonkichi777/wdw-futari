import { describe, expect, it } from "vitest";
import { RIDES } from "../data/rides";
import { matchesQuery, normalize } from "./search";

const hits = (q: string): string[] => RIDES.filter((r) => matchesQuery(r, q)).map((r) => r.id);

describe("検索", () => {
  it("カタカナ・ひらがな・全角英字・空白や中黒の違いを気にしない", () => {
    expect(normalize("プー・さん")).toBe(normalize("ぷーさん"));
    expect(normalize("ＴＲＯＮ")).toBe("tron");
  });

  it("空なら全件", () => {
    expect(hits("")).toHaveLength(RIDES.length);
    expect(hits("  ")).toHaveLength(RIDES.length);
  });

  it("ひらがなでもプーさんのアトラクションとグリーティングが見つかる", () => {
    const r = hits("ぷーさん");
    expect(r).toContain("pooh");
    expect(r).toContain("meet-pooh-tigger-mk");
    expect(r).toContain("meet-pooh-uk");
  });

  it("英語名でも見つかる", () => {
    expect(hits("tron")).toContain("tron");
  });

  it("キャラクター名でグリーティングが見つかる（ミニー）", () => {
    const r = hits("ミニー");
    expect(r).toContain("meet-minnie-daisy-sideshow");
    expect(r).toContain("meet-mickey-minnie-red-carpet");
  });

  it("言葉を並べると、すべてを含むものだけ", () => {
    const r = hits("ミッキー エプコット");
    expect(r).toContain("meet-mickey-friends-communicore");
    expect(r).not.toContain("meet-mickey-town-square");
  });
});
