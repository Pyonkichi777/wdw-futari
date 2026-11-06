import type { Plan } from "./plan";

/** 確認した作戦と違う版なら、古い画面からの上書きを止める（復元にも適用） */
export function guardPlanChange(expected: Plan | null, latest: Plan, change: (p: Plan) => Plan): Plan {
  if (expected === null) throw Object.assign(new Error("作戦を読み込み中です"), { code: "plan/not-ready" });
  if (JSON.stringify(expected) !== JSON.stringify(latest)) throw Object.assign(new Error("作戦が更新されています"), { code: "plan/conflict" });
  return change(latest);
}
