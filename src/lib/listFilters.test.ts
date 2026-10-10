import { describe, expect, it } from "vitest";
import { RIDES } from "../data/rides";
import { EMPTY_FILTERS, applyFilters, isFiltered, parseFilters } from "./listFilters";

describe("絞り込み条件の保存と読み直し", () => {
  it("保存した条件をそのまま読み直せる", () => {
    const f = { park: "MK", kind: "greet", features: ["top10", "single"], statuses: ["must", "none"], q: "ミッキー" };
    expect(parseFilters(JSON.parse(JSON.stringify(f)))).toEqual(f);
  });

  it("何も保存されていなければ絞り込みなし", () => {
    expect(parseFilters(null)).toEqual(EMPTY_FILTERS);
    expect(parseFilters("壊れた値")).toEqual(EMPTY_FILTERS);
  });

  it("知らない値（古い版の条件など）は捨てる", () => {
    const f = parseFilters({ park: "XX", kind: 3, features: ["top10", "消えた条件", "top10"], statuses: ["must", "maybe"] });
    expect(f).toEqual({ park: "ALL", kind: "ALL", features: ["top10"], statuses: ["must"], q: "" });
  });

  it("絞り込み中かどうか", () => {
    expect(isFiltered(EMPTY_FILTERS)).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTERS, statuses: ["none"] })).toBe(true);
  });

  it("リンクで飛んできたアトラクションは、条件に合わなくても表示する", () => {
    const target = RIDES.find((r) => r.park === "AK")!;
    const f = { ...EMPTY_FILTERS, park: "MK" as const, statuses: ["none" as const] };
    const plain = applyFilters(RIDES, f, {});
    expect(plain.rides.some((r) => r.id === target.id)).toBe(false);
    expect(plain.rides.every((r) => r.park === "MK")).toBe(true);
    const kept = applyFilters(RIDES, f, {}, target.id);
    expect(kept.rides).toHaveLength(plain.rides.length + 1);
    expect(kept.rides.some((r) => r.id === target.id)).toBe(true);
  });

  it("回答で絞っても、件数を数える base は回答以外の条件だけで決まる", () => {
    const first = RIDES[0]!;
    const r = applyFilters(RIDES, { ...EMPTY_FILTERS, statuses: ["must"] }, { [first.id]: "must" });
    expect(r.rides.map((x) => x.id)).toEqual([first.id]);
    expect(r.base).toHaveLength(RIDES.length);
  });
});
