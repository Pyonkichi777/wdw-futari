import type { ParkId, Ride } from "../types";
import { dayTimes, type FixedTimes } from "./bookTimes";
import type { HoursFeed } from "./hours";
import type { DayPlan } from "./plan";
import { dayTimeline, gapMinutes, travel } from "./timing";

/** 予定どうしの間の空き時間が、これ以上ならホテルでの休憩を提案する（分） */
export const IDLE_ALERT_MINUTES = 3 * 60;

export interface IdleSpan {
  /** 空きの始まり（前の予定が終わり、移動・余裕を足した時刻）と、次の予定の時刻（分） */
  from: number;
  to: number;
  /** その間いるパーク（ホテルとの往復時間の計算に使う） */
  park: ParkId;
  /** ホテル（ポップセンチュリー）との往復（分） */
  hotelRoundTrip: number;
}

export interface DayAdvice {
  idle: IdleSpan[];
  /** 昼の時間帯にパークにいるのに、昼食が入っていない */
  noLunch: boolean;
  /** 夜までパークにいるのに、夕食が入っていない */
  noDinner: boolean;
}

/** 1日の予定の「空きすぎ」と「食事なし」を調べる（作戦タブと同じ時刻の計算） */
export function dayAdvice(day: DayPlan, rideById: (id: string) => Ride | undefined, hours?: HoursFeed | null, fixed?: FixedTimes): DayAdvice {
  const t = dayTimes(day, rideById, hours, fixed);
  const idle: IdleSpan[] = [];
  let prevEnd: number | null = null;
  let prevPark: ParkId | null = null;
  let between = 0;
  let firstAt: number | null = null;
  let lastEnd = 0;
  for (const s of dayTimeline(day, rideById).segments) {
    if (s.type === "gap") {
      between += gapMinutes(s.gap);
      continue;
    }
    if (s.type === "travel") {
      if (prevEnd !== null) between += s.leg.minutes;
      continue;
    }
    const at = t.hints.get(s.ride.id)?.at;
    if (at === undefined) continue;
    if (firstAt === null) firstAt = at;
    if (prevEnd !== null && prevPark !== null) {
      const free = at - (prevEnd + between);
      if (free >= IDLE_ALERT_MINUTES) idle.push({ from: prevEnd + between, to: at, park: prevPark, hotelRoundTrip: (travel(prevPark, "HOTEL")?.minutes ?? 30) * 2 });
    }
    prevEnd = at + s.minutes;
    lastEnd = Math.max(lastEnd, prevEnd);
    prevPark = s.park;
    between = 0;
  }
  const meals = day.items.filter((i) => i.method === "meal");
  const hasLunch = meals.some((i) => i.slot === "lunch" || i.slot === "pm");
  const hasDinner = meals.some((i) => i.slot === "dinner" || i.slot === "night");
  const start = firstAt ?? 0;
  return {
    idle,
    // 11:30より前からいて、14:00を過ぎてもいる日
    noLunch: day.items.length > 0 && !hasLunch && start <= 11 * 60 + 30 && lastEnd >= 14 * 60,
    // 17:00より前からいて、19:30を過ぎてもいる日
    noDinner: day.items.length > 0 && !hasDinner && start <= 17 * 60 && lastEnd >= 19 * 60 + 30,
  };
}
