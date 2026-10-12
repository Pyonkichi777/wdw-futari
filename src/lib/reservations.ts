import { TRIP } from "../data/trip";
import type { Ride } from "../types";
import { bookingOpensJst, lightningLaneOpensJst } from "./dining";
import type { Plan } from "./plan";

/** 事前に予約・購入が必要なもの（作戦から自動で作る） */
export interface ReservationTask {
  id: string;
  title: string;
  detail: string;
  /** いつから予約・購入できるか（日本時間の文字列） */
  opens: string;
  kind: "dining" | "multi" | "single";
}

const md = (iso: string): string => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const MEAL: Record<string, string> = { am: "朝食", early: "朝食", lunch: "昼食", pm: "昼食", dinner: "夕食", night: "夕食" };

export function reservationTasks(plan: Plan, rideById: (id: string) => Ride | undefined): ReservationTask[] {
  const out: ReservationTask[] = [];
  const llOpens = `${lightningLaneOpensJst(TRIP.checkIn)}（日本時間）`;
  for (const d of plan.days) {
    const multi = d.items.filter((i) => i.method === "multi").flatMap((i) => rideById(i.rideId) ?? []);
    if (multi.length > 0 || d.items.some((i) => i.method === "multiExtra")) {
      out.push({
        id: `mp:${d.date}`,
        kind: "multi",
        title: `${md(d.date)} Multi Pass を買って事前予約`,
        detail: multi.length > 0 ? `事前予約: ${multi.map((r) => `${r.multiPassTier === 1 && r.park !== "AK" ? "★" : ""}${r.nameJa}`).join("、")}` : "事前予約なし（当日の追加予約用）",
        opens: llOpens,
      });
    }
    for (const it of d.items) {
      const r = rideById(it.rideId);
      if (!r) continue;
      if (it.method === "single") {
        out.push({ id: `sp:${d.date}:${r.id}`, kind: "single", title: `${md(d.date)} Single Pass を買う: ${r.nameJa}`, detail: "1本ずつ有料。売り切れることがあるので予約開始と同時に", opens: llOpens });
      }
      if (it.method === "meal" && r.dining && r.dining.booking !== "none") {
        out.push({
          id: `dine:${d.date}:${r.id}`,
          kind: "dining",
          title: `${md(d.date)} ${MEAL[it.slot] ?? "食事"}の予約: ${r.nameJa}`,
          detail: r.dining.booking === "hotel" ? "ホテル側で予約（方法は公式ページで確認）" : "公式アプリ「My Disney Experience」で予約。2人分",
          opens: r.dining.booking === "hotel" ? "ホテルの予約受付しだい" : `${bookingOpensJst(TRIP.checkIn)}（日本時間）`,
        });
      }
    }
  }
  // 予約が早く始まるもの（レストラン）から
  const order = { dining: 0, multi: 1, single: 2 } as const;
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}
