import { parkName } from "../data/parks";
import type { Plan } from "./plan";

const md = (iso: string): string => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/** 作戦を置き換える前に、何が変わるかを短い文で（日割り・入る／外れる予定の数） */
export function planDiff(from: Plan, to: Plan, nameOf: (id: string) => string): string[] {
  const out: string[] = [];
  const dates = [...new Set([...from.days, ...to.days].map((d) => d.date))].sort();
  for (const date of dates) {
    const a = from.days.find((d) => d.date === date);
    const b = to.days.find((d) => d.date === date);
    const parts: string[] = [];
    if (a && b && a.morningPark !== b.morningPark) parts.push(`${parkName(a.morningPark)} → ${parkName(b.morningPark)}`);
    const aIds = new Set((a?.items ?? []).map((i) => i.rideId));
    const bIds = new Set((b?.items ?? []).map((i) => i.rideId));
    const added = [...bIds].filter((id) => !aIds.has(id));
    const removed = [...aIds].filter((id) => !bIds.has(id));
    if (added.length > 0) parts.push(`入る ${added.length}件（${added.slice(0, 3).map(nameOf).join("、")}${added.length > 3 ? "…" : ""}）`);
    if (removed.length > 0) parts.push(`外れる ${removed.length}件（${removed.slice(0, 3).map(nameOf).join("、")}${removed.length > 3 ? "…" : ""}）`);
    if (parts.length > 0) out.push(`${md(date)}: ${parts.join("・")}`);
  }
  return out;
}
