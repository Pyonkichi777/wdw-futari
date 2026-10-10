import { describe, expect, it } from "vitest";
import { RIDES } from "./rides";
import { GREETINGS } from "./greetings";

describe("グリーティングのデータ", () => {
  it("idが全体で重ならない", () => {
    const ids = RIDES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("どれも種類がグリーティングで、時短パスなし・会えるキャラクターつき", () => {
    for (const g of GREETINGS) {
      expect(g.kind).toBe("greet");
      expect(g.lightningLane).toBe("none");
      expect(g.greet?.characters).toBeTruthy();
      expect(g.officialPath.startsWith("/")).toBe(true);
    }
  });

  it("ミッキー・ミニー・プーさんに会える場所がある", () => {
    const who = GREETINGS.map((g) => g.greet?.characters ?? "").join(" ");
    for (const name of ["ミッキー", "ミニー", "プーさん"]) expect(who).toContain(name);
  });
});
