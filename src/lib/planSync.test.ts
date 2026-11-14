import { describe, expect, it } from "vitest";
import { emptyPlan, type Plan } from "./plan";
import { guardPlanChange } from "./planSync";

describe("T03: 同時変更と復元", () => {
  const a = { ...emptyPlan(), updatedAt: 1 };
  const b = { ...a, updatedAt: 2 };
  it("表示中の版なら保存でき、相手の変更後には書かずに競合を返す", () => {
    expect(guardPlanChange(a, a, (p) => ({ ...p, dropLow: true }))).toMatchObject({ dropLow: true });
    expect(() => guardPlanChange(a, b, (p) => ({ ...p, dropLow: true }))).toThrow("更新");
    expect(b).not.toHaveProperty("dropLow");
  });
  it("復元も、確認後に相手が変更したら止め、最新を確認後なら保存できる", () => {
    const snapshot: Plan = emptyPlan();
    expect(() => guardPlanChange(a, b, () => snapshot)).toThrow("更新");
    expect(guardPlanChange(b, b, () => snapshot)).toEqual(snapshot);
  });
  it("まだ読み込めていなければ空の作戦で上書きしない", () => {
    expect(() => guardPlanChange(null, b, () => emptyPlan())).toThrow("読み込み");
  });
});
