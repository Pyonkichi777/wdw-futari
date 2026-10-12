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
