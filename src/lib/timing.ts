import type { ParkId, Ride } from "../types";
import type { DayPlan, Method, PlanItem } from "./plan";

/**
 * 所要時間と移動時間の「ざっくり」の目安（分）。5月の平日の混み具合を想定した概算で、
 * 待ち時間・乗っている時間・次の場所までの歩きを含む。当日の実際の待ち時間とは違うことがある。
 */

/** ふつうに並んだときの待ち時間の目安 */
function standbyWait(r: Ride): number {
  if (r.lightningLane === "single") return 90;
  if (r.multiPassTier === 1) return 60;
  if (r.lightningLane === "multi") return 40;
  return 15;
}

const WALK = 10;

/** 1つの項目にかかる時間の目安（分） */
export function itemMinutes(r: Ride, method: Method): number {
  switch (r.kind) {
    case "dining":
      return r.dining?.style === "counter" ? 40 : 75;
    case "parade":
    case "night":
      return 45; // 場所取りを含む
    case "show":
      return 40;
    case "greet":
      return 30;
    case "walk":
      return 30;
    default:
      break;
  }
  const ride = 10;
  const wait: Record<Method, number> = {
    early: 15,
    single: 15,
    multi: 15,
    multiExtra: 15,
    singleRider: 25,
    standby: standbyWait(r),
    show: 30,
    meal: 60,
  };
  return wait[method] + ride + WALK;
}

/** 行き方 */
export type Transport = "skyliner" | "bus" | "monorail" | "walk";

export const TRANSPORT_LABEL: Record<Transport, string> = {
  skyliner: "ゴンドラ（スカイライナー）",
  bus: "バス",
  monorail: "モノレール",
  walk: "徒歩・ボート",
};

export interface Leg {
  minutes: number;
  by: Transport;
}

type Place = ParkId | "HOTEL";

/** ポップセンチュリー（HOTEL）と各パークの間の移動の目安（待ち時間込み） */
const LEGS: Record<string, Leg> = {
  "HOTEL-EP": { minutes: 25, by: "skyliner" },
  "HOTEL-HS": { minutes: 20, by: "skyliner" },
  "HOTEL-MK": { minutes: 30, by: "bus" },
  "HOTEL-AK": { minutes: 25, by: "bus" },
  "EP-HS": { minutes: 25, by: "skyliner" },
  "EP-MK": { minutes: 40, by: "monorail" },
  "EP-AK": { minutes: 30, by: "bus" },
  "HS-MK": { minutes: 35, by: "bus" },
  "HS-AK": { minutes: 30, by: "bus" },
  "MK-AK": { minutes: 35, by: "bus" },
};

export function travel(from: Place, to: Place): Leg | null {
  if (from === to) return null;
  return LEGS[`${from}-${to}`] ?? LEGS[`${to}-${from}`] ?? { minutes: 35, by: "bus" };
}

export type Segment =
  | { type: "travel"; from: Place; to: Place; leg: Leg }
  | { type: "item"; item: PlanItem; ride: Ride; park: ParkId; minutes: number };

/** 1日の流れ（ホテル → パーク → …（ホッパー）… → ホテル）と所要時間 */
export function dayTimeline(day: DayPlan, rideById: (id: string) => Ride | undefined): { segments: Segment[]; totalMinutes: number } {
  const segments: Segment[] = [];
  let at: Place = "HOTEL";
  const go = (to: Place): void => {
    const leg = travel(at, to);
    if (leg) segments.push({ type: "travel", from: at, to, leg });
    at = to;
  };
  for (const item of day.items) {
    const ride = rideById(item.rideId);
    if (!ride) continue;
    // ホテルのレストランは、そのホテルがあるエリアのパークの近くとして扱う
    go(ride.park);
    segments.push({ type: "item", item, ride, park: ride.park, minutes: itemMinutes(ride, item.method) });
  }
  if (day.items.length === 0) go(day.morningPark);
  // 夕方に別のパークへ行く日は、そこに予定がなくても移動を表示する（夕食・散策など）
  if (day.eveningPark !== day.morningPark) go(day.eveningPark);
  go("HOTEL");
  const totalMinutes = segments.reduce((s, x) => s + (x.type === "travel" ? x.leg.minutes : x.minutes), 0);
  return { segments, totalMinutes };
}

/** 1日に使える時間の目安（開園前入園から花火まで、昼休みなしで約13時間） */
export const DAY_LIMIT_MINUTES = 13 * 60;

export const hoursText = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round((min % 60) / 5) * 5;
  return m === 0 ? `約${h}時間` : h === 0 ? `約${m}分` : `約${h}時間${m}分`;
};
