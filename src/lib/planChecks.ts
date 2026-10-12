import type { ConsensusItem, Ride } from "../types";
import { STAR_WARS_DAY, needsMultiPass, unplaced, type Plan } from "./plan";
import { DAY_LIMIT_MINUTES, dayTimeline, hoursText } from "./timing";

export interface PlanWarning {
  level: "red" | "yellow";
  message: string;
  date?: string;
}

const md = (iso: string): string => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/** 作戦の自動チェック（赤＝必ず直す、黄＝注意） */
export function checkPlan(plan: Plan, consensus: readonly ConsensusItem[], rideById: (id: string) => Ride | undefined): PlanWarning[] {
  const out: PlanWarning[] = [];
  const name = (id: string): string => rideById(id)?.nameJa ?? id;

  for (const c of unplaced(plan, consensus)) {
    if (c.rank === "S") out.push({ level: "red", message: `Sの「${name(c.rideId)}」がどの日にも入っていません` });
  }
  for (const e of plan.excluded ?? []) {
    if (consensus.find((c) => c.rideId === e.rideId)?.rank === "S") out.push({ level: "yellow", message: `Sの「${name(e.rideId)}」を作戦から外しています（「外したもの」から戻せます）` });
  }

  for (const d of plan.days) {
    const day = md(d.date);
    const early = d.items.filter((i) => i.method === "early");
    if (early.length > 1) out.push({ level: "red", date: d.date, message: `${day}: 朝イチが${early.length}本あります（1本だけにする）` });
    for (const i of early) {
      const r = rideById(i.rideId);
      if (r && !r.earlyEntry) out.push({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」は開園前入園の対象外なので朝イチにできません` });
    }
    const multi = d.items.filter((i) => i.method === "multi");
    if (multi.length > 3) out.push({ level: "red", date: d.date, message: `${day}: Multi Passの事前予約が${multi.length}本あります（3本まで）` });
    const tier1 = multi.filter((i) => {
      const r = rideById(i.rideId);
      return r?.multiPassTier === 1 && r.park !== "AK";
    });
    if (tier1.length > 1) out.push({ level: "red", date: d.date, message: `${day}: 人気グループの事前予約が${tier1.length}本あります（1日1本まで。残りは追加予約に）` });
    const single = d.items.filter((i) => i.method === "single");
    if (single.length > 2) out.push({ level: "red", date: d.date, message: `${day}: Single Passが${single.length}本あります（1日2本まで）` });

    for (const i of d.items) {
      const r = rideById(i.rideId);
      if (!r) continue;
      if (i.method === "multi" || i.method === "multiExtra") {
        if (r.lightningLane !== "multi") out.push({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」はMulti Passの対象外です` });
      }
      if (i.method === "single" && r.lightningLane !== "single") out.push({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」はSingle Passの対象外です` });
      if (i.method === "singleRider" && !r.singleRider) out.push({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」に1人乗り専用の列はありません` });
      // その時間にいるパーク（午後はどちらでもよい）
      const parks = i.slot === "dinner" || i.slot === "night" ? [d.eveningPark] : i.slot === "pm" ? [d.morningPark, d.eveningPark] : [d.morningPark];
      if (!parks.includes(r.park)) out.push({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」はその時間にいるパークにありません` });
      if (r.dining && i.method === "meal") {
        const meal = i.slot === "dinner" || i.slot === "night" ? "dinner" : i.slot === "lunch" || i.slot === "pm" ? "lunch" : "breakfast";
        if (!r.dining.meals.includes(meal)) out.push({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」はその時間帯に営業していません（キャラクターが出る時間帯でない）` });
      }
      if (rideRank(consensus, i.rideId) === "S" && i.method === "standby" && r.lightningLane !== "none") {
        out.push({ level: "yellow", date: d.date, message: `${day}: Sの「${r.nameJa}」がふつうに並ぶだけになっています（時短パスを検討）` });
      }
    }
    const breakfast = d.items.find((i) => i.method === "meal" && (i.slot === "early" || i.slot === "am"));
    if (breakfast && early.length > 0) {
      out.push({ level: "yellow", date: d.date, message: `${day}: 朝イチと朝食「${name(breakfast.rideId)}」が重なりやすいので、朝食は朝イチの1本に乗った後の時間（9時半ごろ以降）で予約する` });
    }
    const total = dayTimeline(d, rideById).totalMinutes;
    if (total > DAY_LIMIT_MINUTES) out.push({ level: "yellow", date: d.date, message: `${day}: 予定の合計が${hoursText(total)}で、1日に回れる目安（約13時間）を超えています。Bを減らすか別の日へ` });
    if (d.date === STAR_WARS_DAY && (d.morningPark === "HS" || d.eveningPark === "HS")) {
      out.push({ level: "yellow", date: d.date, message: `${day}: スター・ウォーズの日でハリウッド・スタジオがとても混みます` });
    }
  }

  const mpDays = plan.days.filter(needsMultiPass).length;
  if (mpDays > 0) out.push({ level: "yellow", message: `Multi Passを買う日: ${mpDays}日（1日ごとに1人分ずつ料金がかかります）` });
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "red" ? -1 : 1));
}

const rideRank = (consensus: readonly ConsensusItem[], id: string): string | undefined => consensus.find((c) => c.rideId === id)?.rank;
