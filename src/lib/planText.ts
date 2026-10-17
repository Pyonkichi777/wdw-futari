import { parkName } from "../data/parks";
import type { Ride } from "../types";
import { dayTimes } from "./bookTimes";
import { fixedTimesFor, type Checks } from "./checks";
import type { HoursFeed } from "./hours";
import { METHOD_LABEL, type Plan } from "./plan";
import { reservationTasks } from "./reservations";

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const md = (iso: string): string => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${WD[new Date(`${iso}T12:00:00Z`).getUTCDay()]})`;

/**
 * 作戦を文字だけで控える（電波がないときに見る用）。日ごとの予定と目安時刻、取れた予約の時刻、予約の状況。
 * 作戦タブと同じ計算（目安時刻・取れた予約の時刻）を使う
 */
export function planToText(plan: Plan, checks: Checks, rideById: (id: string) => Ride | undefined, hours: HoursFeed | null, now: Date): string {
  const lines: string[] = [];
  lines.push("ぞうたんフロリダ上陸ツアー 作戦の控え");
  lines.push(`控えた日時: ${now.toLocaleString("ja-JP")}（これより後の変更は入っていません）`);
  lines.push("時刻は目安（取れた予約は「取れた予約」と表示）");
  for (const d of plan.days) {
    lines.push("");
    lines.push(`■ ${md(d.date)} ${parkName(d.morningPark)}${d.eveningPark !== d.morningPark ? ` → 夕方から${parkName(d.eveningPark)}` : ""}`);
    if (d.items.length === 0) {
      lines.push("  （予定なし）");
      continue;
    }
    const t = dayTimes(d, rideById, hours, fixedTimesFor(checks, d.date));
    for (const i of d.items) {
      const r = rideById(i.rideId);
      lines.push(`  ${t.hints.get(i.rideId)?.text ?? ""}　${r?.nameJa ?? i.rideId}（${METHOD_LABEL[i.method]}）`);
    }
  }
  const tasks = reservationTasks(plan, rideById).filter((x) => x.kind !== "singleOptional");
  if (tasks.length > 0) {
    lines.push("");
    lines.push("■ 予約・購入の状況");
    for (const x of tasks) {
      const c = checks[x.id];
      const got = c?.got ? `（取れた時刻: ${Object.entries(c.got).map(([rid, hm]) => `${rideById(rid)?.nameJa ?? rid} ${hm}`).join("、")}）` : "";
      lines.push(`  ${c ? "✓ 取得済み" : "□ まだ"}　${x.title}${got}`);
    }
  }
  return lines.join("\n");
}
