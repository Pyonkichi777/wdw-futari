import { COORDS } from "../data/coords";
import type { ParkId, Ride } from "../types";
import { distanceKm } from "./location";
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

/** 歩く速さ（混雑の中で、km/時）と、道が直線より長くなる割合 */
const WALK_KMH = 3;
const PATH_FACTOR = 1.4;
/** 同じパークの中で次の場所へ歩く時間の最低（分）。場所の座標がないときは 10 分 */
const WALK_MIN = 5;
const WALK_UNKNOWN = 10;
/** 予定と予定の間に毎回とる余裕（分）の既定（Toshi指定で15分）。予定ごとにプルダウンで 5〜120 分に変えられる（PlanItem.buffer） */
export const BUFFER_MINUTES = 15;
/** トイレ・休憩: 食事以外でこの分数ほど動き続けたら、次の予定の前にとる */
export const REST_EVERY_MINUTES = 90;
export const REST_MINUTES = 15;

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
  // 歩く時間は予定と予定の間で、距離から別に計算する（walkMinutes）
  return wait[method] + ride;
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

/** 同じパークの中で、前の場所から次の場所へ歩く時間（分）。地図上の距離から */
export function walkMinutes(fromId: string, toId: string): number {
  const a = COORDS[fromId];
  const b = COORDS[toId];
  if (!a || !b) return WALK_UNKNOWN;
  const km = distanceKm({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) * PATH_FACTOR;
  return Math.max(WALK_MIN, Math.round((km / WALK_KMH) * 60));
}

/** 予定と予定の間（歩く時間・余裕・トイレ休憩） */
export interface Gap {
  /** 同じパークの中で歩く時間（パークを移るときは「移動」に含まれるので 0） */
  walk: number;
  buffer: number;
  /** トイレ・休憩（0 か REST_MINUTES） */
  rest: number;
  /** 前の予定の後にお土産を見る時間（2人が選んだ分） */
  shop: number;
}
export const gapMinutes = (g: Gap): number => g.shop + g.walk + g.buffer + g.rest;

export type Segment =
  | { type: "travel"; from: Place; to: Place; leg: Leg }
  | { type: "gap"; gap: Gap }
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
  let prev: { id: string; park: ParkId; shop: number; buffer: number } | null = null;
  // 食事以外で動き続けた時間（トイレ・休憩をとるか決める）
  let active = 0;
  for (const item of day.items) {
    const ride = rideById(item.rideId);
    if (!ride) continue;
    const before = at as Place;
    // ホテルのレストランは、そのホテルがあるエリアのパークの近くとして扱う
    go(ride.park);
    if (prev) {
      const walk = before === ride.park && prev.park === ride.park ? walkMinutes(prev.id, ride.id) : 0;
      active += prev.shop;
      // 余裕を15分以上とっていれば、そこでトイレ・休憩もとれるとみなす（別に足さない）
      const longBreak = prev.buffer >= REST_MINUTES;
      const rest = !longBreak && active >= REST_EVERY_MINUTES && item.method !== "meal" ? REST_MINUTES : 0;
      if (rest > 0 || longBreak) active = 0;
      segments.push({ type: "gap", gap: { shop: prev.shop, walk, buffer: prev.buffer, rest } });
      active += walk + (longBreak ? 0 : prev.buffer);
    }
    const minutes = itemMinutes(ride, item.method);
    segments.push({ type: "item", item, ride, park: ride.park, minutes });
    // 食事は座って休めるので、そこで数え直す
    active = item.method === "meal" ? 0 : active + minutes;
    prev = { id: ride.id, park: ride.park, shop: item.shop ?? 0, buffer: item.buffer ?? BUFFER_MINUTES };
  }
  // その日の最後の予定の後にお土産を見るなら、ホテルへ戻る前に
  if (prev && prev.shop > 0) segments.push({ type: "gap", gap: { shop: prev.shop, walk: 0, buffer: 0, rest: 0 } });
  // 予定のないパークへの移動は描かない（予定のない日の往復や、予定のない「夕方から」のパークの経由を、確定した行程に見せない）
  go("HOTEL");
  const totalMinutes = segments.reduce((s, x) => s + (x.type === "travel" ? x.leg.minutes : x.type === "gap" ? gapMinutes(x.gap) : x.minutes), 0);
  return { segments, totalMinutes };
}

/** 1日に使える時間の目安（開園前入園から花火まで、昼休みなしで約13時間） */
export const DAY_LIMIT_MINUTES = 13 * 60;

export const hoursText = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round((min % 60) / 5) * 5;
  return m === 0 ? `約${h}時間` : h === 0 ? `約${m}分` : `約${h}時間${m}分`;
};
