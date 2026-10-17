import type { Ride } from "../types";
import { timeHints } from "./bookTimes";
import type { HoursFeed } from "./hours";
import { METHOD_LABEL, type Method, type Plan, type Slot } from "./plan";

export interface PlanPlace {
  date: string;
  slot: Slot;
  method: Method;
  /** 作戦タブと同じ計算の目安時刻（例: 「14:30〜15:30の枠」） */
  time: string | null;
}

/** そのアトラクション・店が、今の作戦のどこに入っているか（ニュースなど、作戦の外から参照する） */
export function placesInPlan(plan: Plan, rideId: string, rideById: (id: string) => Ride | undefined, hours?: HoursFeed | null): PlanPlace[] {
  return plan.days.flatMap((d) =>
    d.items
      .filter((i) => i.rideId === rideId)
      .map((i) => ({ date: d.date, slot: i.slot, method: i.method, time: timeHints(d, rideById, hours).get(rideId)?.text ?? null })),
  );
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];
const md = (iso: string): string => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${WD[new Date(`${iso}T12:00:00Z`).getUTCDay()]})`;

/** 「5/4(火) 14:30〜15:30の枠・Multi Pass（事前予約）」 */
export const placeText = (p: PlanPlace): string => `${md(p.date)} ${p.time ?? ""}・${METHOD_LABEL[p.method]}`.replace(" ・", "・");
