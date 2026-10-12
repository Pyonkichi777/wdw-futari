import { describe, expect, it } from "vitest";
import { rideById } from "../data/rides";
import { dayTimeline, hoursText, itemMinutes, travel } from "./timing";
import { whereAmI } from "./location";

const r = (id: string) => rideById(id)!;

describe("所要時間の目安", () => {
  it("時短パスや朝イチは、ふつうに並ぶより短い", () => {
    expect(itemMinutes(r("flight-of-passage"), "early")).toBeLessThan(itemMinutes(r("flight-of-passage"), "standby"));
    expect(itemMinutes(r("slinky-dog"), "multi")).toBeLessThan(itemMinutes(r("slinky-dog"), "standby"));
  });
  it("人気の乗り物ほど、ふつうに並ぶと長い", () => {
    expect(itemMinutes(r("rise-of-the-resistance"), "standby")).toBeGreaterThan(itemMinutes(r("toy-story-mania"), "standby"));
  });
  it("レストランは1時間以上", () => {
    expect(itemMinutes(r("dine-crystal-palace"), "meal")).toBeGreaterThanOrEqual(60);
  });
  it("時間の表示", () => {
    expect(hoursText(630)).toBe("約10時間30分");
    expect(hoursText(45)).toBe("約45分");
    expect(hoursText(120)).toBe("約2時間");
  });
});

describe("移動の目安", () => {
  it("ホテルからエプコットとスタジオはゴンドラ、MKとAKはバス", () => {
    expect(travel("HOTEL", "EP")?.by).toBe("skyliner");
    expect(travel("HOTEL", "HS")?.by).toBe("skyliner");
    expect(travel("HOTEL", "MK")?.by).toBe("bus");
    expect(travel("AK", "HOTEL")?.by).toBe("bus");
    expect(travel("EP", "EP")).toBeNull();
  });

  it("1日の流れ: ホテル→朝のパーク→（ホッパー）→夕方のパーク→ホテル", () => {
    const day = {
      date: "2027-05-02",
      morningPark: "AK" as const,
      eveningPark: "EP" as const,
      items: [
        { rideId: "flight-of-passage", slot: "early" as const, method: "early" as const },
        { rideId: "everest", slot: "am" as const, method: "multi" as const },
        { rideId: "luminous", slot: "night" as const, method: "show" as const },
      ],
    };
    const t = dayTimeline(day, rideById);
    const travels = t.segments.filter((s) => s.type === "travel").map((s) => (s.type === "travel" ? `${s.from}>${s.to}` : ""));
    expect(travels).toEqual(["HOTEL>AK", "AK>EP", "EP>HOTEL"]);
    expect(t.totalMinutes).toBeGreaterThan(120);
  });
});

describe("今いる場所", () => {
  it("パークの中心近くならそのパーク、離れていれば外", () => {
    expect(whereAmI({ lat: 28.3749, lng: -81.5496 }).inside?.id).toBe("EP");
    expect(whereAmI({ lat: 28.352, lng: -81.5425 }).inside?.id).toBe("HOTEL");
    const far = whereAmI({ lat: 28.5383, lng: -81.3792 }); // オーランドの街中
    expect(far.inside).toBeNull();
    expect(far.km).toBeGreaterThan(10);
  });
});

describe("オーランドの今", () => {
  it("日付と時間の枠（夏時間: 日本より13時間遅い）", async () => {
    const { todayInOrlando, slotNow } = await import("../components/WhereNow");
    const t = new Date("2027-05-02T13:00:00Z"); // オーランド 5/2 9:00
    expect(todayInOrlando(t)).toBe("2027-05-02");
    expect(slotNow(t)).toBe("am");
    expect(slotNow(new Date("2027-05-02T23:30:00Z"))).toBe("night"); // 19:30
    expect(slotNow(new Date("2027-05-02T12:00:00Z"))).toBe("early"); // 8:00
  });
});
