import type { Ride } from "../types";
import type { DayPlan } from "./plan";
import { dayTimeline, gapMinutes } from "./timing";
import { toMinutes, type HoursFeed } from "./hours";

/**
 * 予約するときに選ぶ「時間枠」のおすすめ（作戦の流れから逆算した目安）。
 * - 開園 9:00（開園前入園がある日は 8:30）にパークに着く想定で、所要時間を順に足していく
 * - 食事は混む時間を避ける: 朝食 8:00頃・昼食 11:30頃（遅くとも13:30）・夕食 17:30頃（遅くとも19:00）
 * - 次の予定は、いつも前の予定が終わって移動した後から（上から順に読んで重ならない）
 * - 時短パスは「体験を始める目安」と、その時刻が入る1時間の「予約する枠（到着枠）」を分けて示す
 * - ショー・パレード・夜のショーの時刻は仮置き（夜のショーは 20:30 頃から、場所取りを含む）
 * - 2人が「取れた予約の時刻」を入れたら、その時刻に合わせる（前の予定から間に合わなければ知らせる）
 * 開園時間は2027年5月分が出たら確かめ直す
 */
const OPEN = 9 * 60;
const EARLY_OPEN = 8 * 60 + 30;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clock = (m: number): string => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;

export interface TimeHint {
  /** 体験を始める目安（分、0時から）。前の予定が終わって移動した後の時刻 */
  at: number;
  /** 表示（例: 「11:30頃」「13:30頃（予約する枠 13:30〜14:30）」） */
  text: string;
  /** 時短パスの予約枠（到着枠）。この枠のあいだに着けばよい */
  window?: { from: number; to: number };
  /** 取れた予約の時刻（2人が入力したもの）に合わせた */
  fixed?: boolean;
  /** 取れた予約の時刻に、前の予定から間に合わない */
  late?: boolean;
  /** 上演時刻はまだ仮置き（公式の時刻を取り込めていない） */
  tentative?: boolean;
}

/** 取れた予約の時刻（rideId → 分）。食事・Single Pass・Multi Pass の実際の時刻 */
export type FixedTimes = ReadonlyMap<string, number>;

export const timeHints = (day: DayPlan, rideById: (id: string) => Ride | undefined, hours?: HoursFeed | null, fixed?: FixedTimes): Map<string, TimeHint> =>
  dayTimes(day, rideById, hours, fixed).hints;

/** 1日の時刻の目安: パークに着く時刻・各項目の時刻・ホテルに戻る時刻 */
export function dayTimes(
  day: DayPlan,
  rideById: (id: string) => Ride | undefined,
  hours?: HoursFeed | null,
  fixed?: FixedTimes,
): { start: number; end: number; busy: number; idle: number; hints: Map<string, TimeHint>; official: boolean; lateStart: boolean } {
  const out = new Map<string, TimeHint>();
  const { segments } = dayTimeline(day, rideById);
  const hasEarly = day.items.some((i) => i.method === "early");
  // 公式の営業時間が出ていればそれを使う（開園前入園は公式の時刻、なければ開園の30分前）
  const h = hours?.days[day.date]?.[day.morningPark];
  const open = h ? toMinutes(h.open) : OPEN;
  // 朝の予定がない日（予備日で夕食だけ、など）は、その日の最初の予定に合わせて出かける
  const firstSlot = day.items[0]?.slot;
  const lateStart = firstSlot === "lunch" || firstSlot === "pm" || firstSlot === "dinner" || firstSlot === "night";
  const start = lateStart
    ? firstSlot === "lunch"
      ? 11 * 60 + 30
      : firstSlot === "pm"
        ? 13 * 60
        : 17 * 60 + 30
    : hasEarly
      ? h?.early
        ? toMinutes(h.early)
        : h
          ? open - 30
          : EARLY_OPEN
      : open;
  let t = start;
  let arrived = false;
  // 表示する時刻は、前の項目より前にならないようにする（上から下へ時間が進む）
  // 予定の時間（体験＋移動）の合計。パーク着〜ホテル着との差が空き時間
  let busy = 0;
  const ceil30 = (m: number): number => Math.ceil(m / 30) * 30;
  // 「○○頃」は実際より早く見せない（前の予定が終わる前の時刻を出さない）ように切り上げる
  const ceil10 = (m: number): number => Math.ceil(m / 10) * 10;
  // 次の予定は、いつも「前の予定が終わって移動した後」から始める（画面の時刻を上から順に読んでも重ならない）
  for (const seg of segments) {
    if (seg.type === "gap") {
      // 歩く時間・余裕・トイレ休憩
      const m = gapMinutes(seg.gap);
      t += m;
      busy += m;
      continue;
    }
    if (seg.type === "travel") {
      // 最初の移動はホテルからの朝の移動（開園時刻に着くように出る）
      // パーク着より前（ホテルからの朝の移動）は、パーク着〜ホテル着の中に入らない
      if (arrived) {
        t += seg.leg.minutes;
        busy += seg.leg.minutes;
      }
      continue;
    }
    const first = !arrived;
    arrived = true;
    const { item, ride, minutes } = seg;
    busy += minutes;
    const got = fixed?.get(ride.id);
    if (got !== undefined) {
      // 取れた予約の時刻に合わせる（前の予定が終わらないなら「間に合わない」）
      const late = !first && got < t;
      out.set(ride.id, { at: got, text: `${clock(got)}（取れた予約）`, fixed: true, ...(late ? { late: true } : {}) });
      t = Math.max(t, got) + minutes;
      continue;
    }
    if (item.method === "meal") {
      const want =
        item.slot === "dinner" || item.slot === "night"
          ? clamp(ceil30(t), 17 * 60 + 30, 19 * 60)
          : item.slot === "lunch" || item.slot === "pm"
            ? clamp(ceil30(t), 11 * 60 + 30, 13 * 60 + 30)
            : // 朝食: その日の最初なら開園前の 8:00 頃、朝イチの後なら終わってすぐ
              first
              ? 8 * 60
              : ceil30(t);
      // 混む時間を避けた枠（13:30・19:00）より遅くなったら、実際に着ける時刻のまま出す
      const at = first ? want : Math.max(want, ceil10(t));
      out.set(ride.id, { at, text: `${clock(at)}頃` });
      t = at + minutes;
      continue;
    }
    if (ride.kind === "night" || ride.kind === "parade" || ride.kind === "show") {
      // 上演時刻はまだ公式のものを取り込めていないので、仮置き（夜のショーは暗くなってから 20:30 頃）
      const at = ride.kind === "night" ? Math.max(ceil30(t), 20 * 60 + 30) : ceil10(t);
      out.set(ride.id, { at, text: `${clock(at)}頃（上演時刻は仮置き。当日アプリで確認）`, tentative: true });
      t = at + minutes;
      continue;
    }
    const at = ceil10(t);
    if (item.method === "multi" || item.method === "multiExtra" || item.method === "single") {
      // 予約するのは「到着枠」。体験を始める目安がその枠に入るように選ぶ
      const from = Math.floor(at / 30) * 30;
      out.set(ride.id, { at, text: `${clock(at)}頃（予約する枠 ${clock(from)}〜${clock(from + 60)}）`, window: { from, to: from + 60 } });
    } else {
      out.set(ride.id, { at, text: `${clock(at)}頃` });
    }
    t = at + minutes;
  }
  return { start, end: t, busy, idle: Math.max(0, t - start - busy), hints: out, official: h !== undefined, lateStart };
}
