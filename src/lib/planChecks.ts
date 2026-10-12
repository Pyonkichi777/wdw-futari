import type { ConsensusItem, Rank, Ride } from "../types";
import { RANK_ORDER, applyFix, bestMethod, fixMethod, mealOfSlot, suggestPlace, type Fix } from "./planFixes";
import { STAR_WARS_DAY, needsMultiPass, unplaced, type Plan } from "./plan";
import { DAY_LIMIT_MINUTES, dayTimeline, hoursText } from "./timing";
import { parkName } from "../data/parks";

export interface PlanWarning {
  level: "red" | "yellow";
  message: string;
  date?: string;
  /** おすすめの直し方（ボタンひとつで当てられる） */
  fix?: Fix;
}

const md = (iso: string): string => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/** 作戦の自動チェック（赤＝必ず直す、黄＝注意） */
export function checkPlan(plan: Plan, consensus: readonly ConsensusItem[], rideById: (id: string) => Ride | undefined): PlanWarning[] {
  const out: PlanWarning[] = [];
  const name = (id: string): string => rideById(id)?.nameJa ?? id;
  const rankOf = (id: string): Rank => consensus.find((c) => c.rideId === id)?.rank ?? "B";
  const withFix = (w: PlanWarning, fix: Fix | null | undefined): PlanWarning => (fix ? { ...w, fix } : w);

  for (const c of unplaced(plan, consensus)) {
    const r = rideById(c.rideId);
    if (c.rank === "S" && r) out.push(withFix({ level: "red", message: `Sの「${r.nameJa}」がどの日にも入っていません` }, suggestPlace(plan, r, rideById, c.meal ? { meal: c.meal } : {})));
  }
  for (const e of plan.excluded ?? []) {
    if (consensus.find((c) => c.rideId === e.rideId)?.rank === "S") out.push({ level: "yellow", message: `Sの「${name(e.rideId)}」を作戦から外しています（「外したもの」から戻せます）` });
  }

  for (const d of plan.days) {
    const day = md(d.date);
    const early = d.items.filter((i) => i.method === "early");
    if (early.length > 1) {
      // いちばん大事な1本を残し、2本目を午前へ
      const extra = [...early].sort((a, b) => RANK_ORDER[rankOf(a.rideId)] - RANK_ORDER[rankOf(b.rideId)])[1];
      const r = extra && rideById(extra.rideId);
      out.push(withFix({ level: "red", date: d.date, message: `${day}: 朝イチが${early.length}本あります（1本だけにする）` }, r ? fixMethod(d, r, "am", bestMethod(r, d, rideById, r.id), "朝イチは1本だけ。午前に回す") : null));
    }
    for (const i of early) {
      const r = rideById(i.rideId);
      if (r && !r.earlyEntry) out.push(withFix({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」は開園前入園の対象外なので朝イチにできません` }, fixMethod(d, r, "am", bestMethod(r, d, rideById, r.id), "開園後に時短パスで")));
    }
    const multi = d.items.filter((i) => i.method === "multi");
    if (multi.length > 3) {
      const last = [...multi].sort((a, b) => RANK_ORDER[rankOf(b.rideId)] - RANK_ORDER[rankOf(a.rideId)])[0];
      const r = last && rideById(last.rideId);
      out.push(withFix({ level: "red", date: d.date, message: `${day}: Multi Passの事前予約が${multi.length}本あります（3本まで）` }, r && last ? fixMethod(d, r, last.slot, "multiExtra", "優先度のいちばん低いものを、1本使った後の追加予約に") : null));
    }
    const tier1 = multi.filter((i) => {
      const r = rideById(i.rideId);
      return r?.multiPassTier === 1 && r.park !== "AK";
    });
    if (tier1.length > 1) {
      const extra = [...tier1].sort((a, b) => RANK_ORDER[rankOf(a.rideId)] - RANK_ORDER[rankOf(b.rideId)])[1];
      const r = extra && rideById(extra.rideId);
      out.push(
        withFix(
          { level: "red", date: d.date, message: `${day}: 人気グループの事前予約が${tier1.length}本あります（1日1本まで。残りは追加予約に）` },
          r && extra ? fixMethod(d, r, extra.slot, r.singleRider ? "singleRider" : "multiExtra", r.singleRider ? "1人乗り専用の列が使える" : "人気グループは1日1本。もう1本は追加予約で") : null,
        ),
      );
    }
    const single = d.items.filter((i) => i.method === "single");
    if (single.length > 2) {
      const last = [...single].sort((a, b) => RANK_ORDER[rankOf(b.rideId)] - RANK_ORDER[rankOf(a.rideId)])[0];
      const r = last && rideById(last.rideId);
      out.push(withFix({ level: "red", date: d.date, message: `${day}: Single Passが${single.length}本あります（1日2本まで）` }, r ? suggestPlace(plan, r, rideById, { avoidDate: d.date }) : null));
    }

    for (const i of d.items) {
      const r = rideById(i.rideId);
      if (!r) continue;
      if (i.method === "multi" || i.method === "multiExtra") {
        if (r.lightningLane !== "multi") out.push(withFix({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」はMulti Passの対象外です` }, fixMethod(d, r, i.slot, bestMethod(r, d, rideById, r.id), "使える方法に")));
      }
      if (i.method === "single" && r.lightningLane !== "single") out.push(withFix({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」はSingle Passの対象外です` }, fixMethod(d, r, i.slot, bestMethod(r, d, rideById, r.id), "使える方法に")));
      if (i.method === "singleRider" && !r.singleRider) out.push(withFix({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」に1人乗り専用の列はありません` }, fixMethod(d, r, i.slot, bestMethod(r, d, rideById, r.id), "使える方法に")));
      // その時間にいるパーク（午後はどちらでもよい）
      const parks = i.slot === "dinner" || i.slot === "night" ? [d.eveningPark] : i.slot === "pm" ? [d.morningPark, d.eveningPark] : [d.morningPark];
      if (!parks.includes(r.park)) {
        const fix = r.dining ? suggestPlace(plan, r, rideById, { meal: mealOfSlot(i.slot), avoidDate: d.date }) : suggestPlace(plan, r, rideById, { avoidDate: d.date });
        out.push(withFix({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」はその時間にいるパーク（${parks.map(parkName).join("・")}）にありません。この店・乗り物は${parkName(r.park)}${r.dining && !r.dining.inPark ? "エリア" : ""}です` }, fix));
      }
      if (r.dining && i.method === "meal") {
        const meal = i.slot === "dinner" || i.slot === "night" ? "dinner" : i.slot === "lunch" || i.slot === "pm" ? "lunch" : "breakfast";
        if (!r.dining.meals.includes(meal)) out.push(withFix({ level: "red", date: d.date, message: `${day}: 「${r.nameJa}」はその時間帯に営業していません（キャラクターが出る時間帯でない）` }, suggestPlace(plan, r, rideById, {})));
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

/** 🔴の提案を1つずつ当てては調べ直す（前の修正で次の提案が変わるため）。直せないものは残す */
export function fixAllReds(plan: Plan, items: ConsensusItem[], rideById: (id: string) => Ride | undefined, max = 20): Plan {
  let p = plan;
  const tried = new Set<string>();
  for (let n = 0; n < max; n++) {
    const w = checkPlan(p, items, rideById).find((x) => x.level === "red" && x.fix && !tried.has(x.message));
    if (!w?.fix) break;
    tried.add(w.message);
    p = applyFix(p, w.fix);
  }
  return p;
}
