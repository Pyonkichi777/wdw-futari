import type { Ride } from "../types";
import type { DayPlan } from "./plan";
import { dayTimeline } from "./timing";

/**
 * 予約するときに選ぶ「時間枠」のおすすめ（作戦の流れから逆算した目安）。
 * - 開園 9:00（開園前入園がある日は 8:30）にパークに着く想定で、所要時間を順に足していく
 * - 食事は混む時間を避ける: 朝食 8:00頃・昼食 11:30頃（遅くとも13:30）・夕食 17:30頃（遅くとも19:00）
 * - 時短パスは1時間の枠で示す（その時刻に乗れる枠。前後の枠でもよい）
 * - 夜のショーは 20:30 頃から（場所取りを含む）
 * 開園時間は2027年5月分が出たら確かめ直す
 */
const OPEN = 9 * 60;
const EARLY_OPEN = 8 * 60 + 30;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round30 = (m: number): number => Math.round(m / 30) * 30;
export const clock = (m: number): string => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

export interface TimeHint {
  /** 分（0時から） */
  at: number;
  /** 表示（例: 「11:30頃」「10:00〜11:00の枠」） */
  text: string;
}

export const timeHints = (day: DayPlan, rideById: (id: string) => Ride | undefined): Map<string, TimeHint> => dayTimes(day, rideById).hints;

/** 1日の時刻の目安: パークに着く時刻・各項目の時刻・ホテルに戻る時刻 */
export function dayTimes(day: DayPlan, rideById: (id: string) => Ride | undefined): { start: number; end: number; hints: Map<string, TimeHint> } {
  const out = new Map<string, TimeHint>();
  const { segments } = dayTimeline(day, rideById);
  const hasEarly = day.items.some((i) => i.method === "early");
  const start = hasEarly ? EARLY_OPEN : OPEN;
  let t = start;
  let arrived = false;
  for (const seg of segments) {
    if (seg.type === "travel") {
      // 最初の移動はホテルからの朝の移動（開園時刻に着くように出る）
      if (arrived) t += seg.leg.minutes;
      continue;
    }
    arrived = true;
    const { item, ride, minutes } = seg;
    if (item.method === "meal") {
      const at =
        item.slot === "dinner" || item.slot === "night"
          ? clamp(round30(t), 17 * 60 + 30, 19 * 60)
          : item.slot === "lunch" || item.slot === "pm"
            ? clamp(round30(t), 11 * 60 + 30, 13 * 60 + 30)
            : 8 * 60;
      out.set(ride.id, { at, text: `${clock(at)}頃` });
      t = Math.max(t, at) + minutes;
      continue;
    }
    if (ride.kind === "night") {
      // 夜のショー（花火など）は暗くなってから。場所取りを含めて 20:30 頃から
      const at = Math.max(round30(t), 20 * 60 + 30);
      out.set(ride.id, { at, text: `${clock(at)}頃（上演時刻は当日アプリで確認）` });
      t = at + minutes;
      continue;
    }
    if (item.method === "multi" || item.method === "multiExtra" || item.method === "single") {
      const from = Math.floor(t / 30) * 30;
      out.set(ride.id, { at: from, text: `${clock(from)}〜${clock(from + 60)}の枠` });
    } else {
      out.set(ride.id, { at: t, text: `${clock(round30(t))}頃` });
    }
    t += minutes;
  }
  return { start, end: t, hints: out };
}
