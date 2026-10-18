import type { ConsensusItem, MealPeriod, ParkId, PersonId, Rank, Ride } from "../types";
import { STAR_WARS_DAY, crowdScore, type CrowdFeed } from "./crowd";

/** 1日の時間の枠 */
export type Slot = "early" | "am" | "lunch" | "pm" | "dinner" | "night";

/** 乗り方・過ごし方 */
export type Method = "early" | "single" | "multi" | "multiExtra" | "singleRider" | "standby" | "show" | "meal";

export interface PlanItem {
  rideId: string;
  slot: Slot;
  method: Method;
  /** 合意リストにはないが、アプリがおすすめで足したもの（パレードなど） */
  suggested?: boolean;
  /** 2人が手で午前／午後を決めたもの（自動の「近い順」でも午前・午後を入れ替えない） */
  pinned?: true;
  /** 終わった後にお土産を見る時間（分。5〜30の5分刻み） */
  shop?: number;
  /** 終わった後、次の予定までにとる余裕（分。5〜120の5分刻み。なければ 5 分） */
  buffer?: number;
}

export interface DayPlan {
  /** "2027-05-01" */
  date: string;
  morningPark: ParkId;
  /** 夕方以降のパーク（ホッパー）。朝と同じならホッパーしない */
  eveningPark: ParkId;
  items: PlanItem[];
}

/** 作戦から外したもの（どこにあったか・誰が外したかを残し、元に戻せるようにする） */
export interface ExcludedItem extends PlanItem {
  date: string;
  by: PersonId | null;
  at: number;
}

export interface Plan {
  days: DayPlan[];
  /** 作戦から外したもの。作り直しても入れない。2人で共有 */
  excluded?: ExcludedItem[];
  /** 本命パーク（いちばん空いている日に置く） */
  /** 「2人ともどちらでも」をまとめて外した（以後、作り直しても入れない） */
  dropLow?: true;
  /** dropLow のあとで、自分たちで元に戻したもの（これは外さない） */
  keptLow?: string[];
  /** 2人が手で決めた「この日はこのパーク」。組み直しても変えない */
  fixedParks?: FixedParks;
  /** 本命パークの優先順位（第1優先から）。2人で共有 */
  focusParks?: ParkId[];
  updatedBy: PersonId | null;
  updatedAt: number | null;
}

export const SLOT_ORDER: readonly Slot[] = ["early", "am", "lunch", "pm", "dinner", "night"];

export const SLOT_LABEL: Record<Slot, string> = {
  early: "朝イチ（開園前入園）",
  am: "午前",
  lunch: "昼",
  pm: "午後",
  dinner: "夕食",
  night: "夜",
};

export const METHOD_LABEL: Record<Method, string> = {
  early: "朝イチで直行",
  single: "Single Pass（事前に購入・有料）",
  multi: "Multi Pass（事前予約）",
  multiExtra: "Multi Pass（使った後の追加予約）",
  singleRider: "1人乗り専用の列",
  standby: "ふつうに並ぶ",
  show: "上演時刻に行く",
  meal: "予約して食事",
};

export const emptyPlan = (): Plan => ({ days: [], updatedBy: null, updatedAt: null });

const RANK_WEIGHT: Record<Rank, number> = { S: 5, A: 3, B: 1 };

/** 混雑の影響の受けやすさ（人気パークほど大きい） */
const PARK_POPULARITY: Record<ParkId, number> = { MK: 3, HS: 3, EP: 2, AK: 1.5 };

/** 2人が手で決めた「この日はこのパーク」（日付 → パーク）。自動で組み直しても変えない */
export type FixedParks = Partial<Record<string, ParkId>>;

/** 本命パークの優先順位ごとに、混雑の重みを何倍にして空いている日へ寄せるか（第1優先 → 第4優先） */
const FOCUS_FACTORS = [4, 2.5, 1.6, 1.2] as const;
const focusFactor = (park: ParkId, focusParks: readonly ParkId[]): number => {
  const i = focusParks.indexOf(park);
  return i < 0 ? 1 : (FOCUS_FACTORS[i] ?? 1);
};

const PARK_IDS: readonly ParkId[] = ["MK", "EP", "HS", "AK"];

export { STAR_WARS_DAY, isWeekend } from "./crowd";

/** 1日に詰め込みすぎないための目安（乗り物・ショー・グリーティングの数） */
const DAY_CAPACITY = 10;
const MULTI_PREBOOK = 3;
const SINGLE_PER_DAY = 2;

interface Entry {
  ride: Ride;
  rank: Rank;
  meal?: MealPeriod;
  order: number;
}

function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

/**
 * パークを回る日を決める。4パークを1日ずつ（最終日は予備日）。ハリウッド・スタジオはスター・ウォーズの日を避ける。
 * - 本命パークの優先順位があれば、それを最優先: 第1優先のパークに、そのパークがいちばん空いている日を。
 *   次に第2優先に、残りの日でいちばん空いている日を…（優先順位の順に、混雑予想の低い日を取っていく）
 * - 優先順位のないパークと同点のときは、重い（S・Aが多い）パーク・人気のパークほど混む日を避ける
 */
export function chooseParkOrder(
  entries: readonly Entry[],
  dates: readonly string[],
  focusParks: readonly ParkId[] = [],
  crowd: CrowdFeed | null = null,
  fixed: FixedParks = {},
): ParkId[] {
  const weight = (p: ParkId): number => entries.filter((e) => e.ride.park === p).reduce((s, e) => s + RANK_WEIGHT[e.rank], 0) + 1;
  const mainDates = dates.slice(0, PARK_IDS.length);
  // 比べる順: スター・ウォーズの日の禁止 → 第1優先の日の混雑 → 第2優先 → … → 全体の負担
  const keyOf = (order: readonly ParkId[]): number[] => {
    const dateOf = (p: ParkId): string | undefined => mainDates[order.indexOf(p)];
    const banned = order.some((p, i) => p === "HS" && mainDates[i] === STAR_WARS_DAY) ? 1 : 0;
    const prio = focusParks.map((p) => {
      const d = dateOf(p);
      return d ? Math.round(crowdScore(p, d, crowd) * 100) / 100 : 0;
    });
    let cost = 0;
    order.forEach((park, i) => {
      const date = mainDates[i];
      if (date) cost += crowdScore(park, date, crowd) * PARK_POPULARITY[park] * weight(park) * focusFactor(park, focusParks);
    });
    return [banned, ...prio, cost];
  };
  const less = (a: readonly number[], b: readonly number[]): boolean => {
    for (let i = 0; i < a.length; i++) {
      const x = a[i] ?? 0;
      const y = b[i] ?? 0;
      if (Math.abs(x - y) > 1e-9) return x < y;
    }
    return false;
  };
  // 2人が手で決めた日はそのまま。残りの日に、残りのパークを割り当てる
  const used = new Set(mainDates.flatMap((d) => (fixed[d] ? [fixed[d]] : [])));
  const freeParks = PARK_IDS.filter((p) => !used.has(p));
  let best: { order: ParkId[]; key: number[] } | null = null;
  for (const perm of permutations(freeParks)) {
    let k = 0;
    const order = mainDates.map((d) => fixed[d] ?? perm[k++] ?? "MK");
    const key = keyOf(order);
    if (!best || less(key, best.key)) best = { order, key };
  }
  return best ? best.order : [...PARK_IDS];
}

const isRideKind = (r: Ride): boolean => r.kind === "ride";

/** 朝イチに向いている順（Single Pass対象 → 人気グループ → そのほか） */
const earlyScore = (r: Ride): number => (r.lightningLane === "single" ? 3 : r.multiPassTier === 1 ? 2 : 1);

function placeParkDay(day: DayPlan, pool: Entry[], placed: Set<string>, opts: { allowB: boolean }): void {
  const inPark = pool.filter((e) => !placed.has(e.ride.id) && e.ride.park === day.morningPark && e.ride.kind !== "dining");
  const put = (e: Entry, slot: Slot, method: Method): void => {
    day.items.push({ rideId: e.ride.id, slot, method });
    placed.add(e.ride.id);
  };
  const count = (): number => day.items.filter((i) => i.method !== "meal").length;

  // 朝イチ: S→Aの順に、開園前入園できる乗り物から1本
  const early = inPark
    .filter((e) => isRideKind(e.ride) && e.ride.earlyEntry && e.rank !== "B")
    .sort((a, b) => RANK_WEIGHT[b.rank] - RANK_WEIGHT[a.rank] || earlyScore(b.ride) - earlyScore(a.ride) || a.order - b.order)[0];
  if (early) put(early, "early", "early");

  let singles = 0;
  let multiTier1 = 0;
  let multiPre = 0;
  let toggle = 0;
  const nextSlot = (): Slot => (toggle++ % 2 === 0 ? "am" : "pm");
  for (const e of inPark) {
    if (placed.has(e.ride.id)) continue;
    if (e.rank === "B" && (!opts.allowB || count() >= DAY_CAPACITY)) continue;
    if (count() >= DAY_CAPACITY + 2) break;
    const r = e.ride;
    if (r.kind === "ride") {
      if (r.lightningLane === "single") {
        if (singles < SINGLE_PER_DAY) {
          singles += 1;
          put(e, nextSlot(), "single");
        } else put(e, nextSlot(), "standby");
      } else if (r.lightningLane === "multi") {
        const tierLimited = r.multiPassTier === 1 && r.park !== "AK";
        // 事前予約の3枠は、空いていればBでも使う（買った Multi Pass を無駄にしない）
        if (multiPre < MULTI_PREBOOK && (!tierLimited || multiTier1 === 0)) {
          multiPre += 1;
          if (tierLimited) multiTier1 += 1;
          put(e, nextSlot(), "multi");
        } else if (r.singleRider) put(e, nextSlot(), "singleRider");
        else put(e, nextSlot(), e.rank === "B" ? "standby" : "multiExtra");
      } else put(e, nextSlot(), r.singleRider ? "singleRider" : "standby");
    } else if (r.kind === "night") {
      if (day.eveningPark === day.morningPark) put(e, "night", "show");
    } else if (r.kind === "parade") {
      put(e, /starlight|night/.test(r.id) ? "night" : "pm", "show");
    } else if (r.kind === "show") {
      put(e, "pm", "show");
    } else {
      put(e, nextSlot(), "standby");
    }
  }

  // 夕方に別のパークへ行く日は、そのパークの夜のショーと残りのSを夜に回る
  if (day.eveningPark !== day.morningPark) {
    for (const e of pool) {
      if (placed.has(e.ride.id) || e.ride.park !== day.eveningPark || e.ride.kind === "dining") continue;
      if (e.ride.kind === "night") put(e, "night", "show");
      else if (e.rank === "S" && e.ride.kind === "ride") put(e, "night", e.ride.singleRider ? "singleRider" : "standby");
    }
  }
}

/** 食事: 朝・昼は朝のパーク、夜は夕方以降のパークにある店を、その時間帯が空いている日に入れる */
function placeDining(days: DayPlan[], pool: Entry[], placed: Set<string>): void {
  const mealSlot: Record<MealPeriod, Slot> = { breakfast: "am", lunch: "lunch", dinner: "dinner" };
  for (const e of pool) {
    if (placed.has(e.ride.id) || e.ride.kind !== "dining") continue;
    const meal = e.meal ?? e.ride.dining?.meals[0];
    if (!meal) continue;
    const slot = mealSlot[meal];
    const day = days.find(
      (d) => (meal === "dinner" ? d.eveningPark : d.morningPark) === e.ride.park && !d.items.some((i) => i.method === "meal" && i.slot === slot),
    );
    if (!day) continue;
    day.items.push({ rideId: e.ride.id, slot, method: "meal" });
    placed.add(e.ride.id);
  }
}

const sortItems = (items: PlanItem[]): PlanItem[] => [...items].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

/**
 * 合意リストから、おすすめの5日間の作戦を組む。
 * - 1〜4日目: 4パークを1日ずつ（重いパークは週末を避ける。スタジオは5/4を避ける）
 * - アニマルキングダムの日は閉園が早いので、夕方はエプコットへ（ゴンドラでホテルに帰れる）
 * - 5日目: 予備日。置ききれなかったS・Aが一番多いパークへ
 * - 乗り方: 朝イチ1本 → Single Pass（1日2本まで）→ Multi Pass 事前予約3本（人気グループは1本）→ 追加予約・1人乗り列・ふつうに並ぶ
 * - パレード: マジックキングダムの日に1つは入れる（合意リストになければ昼のパレードをおすすめで足す）
 */
export function buildPlan(
  consensus: readonly ConsensusItem[],
  rideById: (id: string) => Ride | undefined,
  dates: readonly string[],
  opts: { focusParks?: readonly ParkId[]; excluded?: readonly ExcludedItem[]; crowd?: CrowdFeed | null; fixedParks?: FixedParks } = {},
): Plan {
  const skip = new Set((opts.excluded ?? []).map((e) => e.rideId));
  const pool: Entry[] = consensus.flatMap((c, order): Entry[] => {
    if (skip.has(c.rideId)) return [];
    const ride = rideById(c.rideId);
    return ride ? [{ ride, rank: c.rank, ...(c.meal ? { meal: c.meal } : {}), order }] : [];
  });
  pool.sort((a, b) => RANK_WEIGHT[b.rank] - RANK_WEIGHT[a.rank] || a.order - b.order);

  const focusParks = opts.focusParks ?? [];
  const order = chooseParkOrder(pool, dates, focusParks, opts.crowd ?? null, opts.fixedParks ?? {});
  return placeAll(pool, order, dates, focusParks, skip, rideById, opts);
}

/** 今の合意リスト・優先順位・混雑予想なら、どの日にどのパークへ行くのがよいか（作戦を作り直さずに確かめる） */
export function parkOrderFor(
  consensus: readonly ConsensusItem[],
  rideById: (id: string) => Ride | undefined,
  dates: readonly string[],
  opts: { focusParks?: readonly ParkId[]; excluded?: readonly ExcludedItem[]; crowd?: CrowdFeed | null; fixedParks?: FixedParks } = {},
): ParkId[] {
  const skip = new Set((opts.excluded ?? []).map((e) => e.rideId));
  const pool: Entry[] = consensus.flatMap((c, order): Entry[] => {
    const ride = skip.has(c.rideId) ? undefined : rideById(c.rideId);
    return ride ? [{ ride, rank: c.rank, order }] : [];
  });
  return chooseParkOrder(pool, dates, opts.focusParks ?? [], opts.crowd ?? null, opts.fixedParks ?? {});
}

function placeAll(
  pool: Entry[],
  order: readonly ParkId[],
  dates: readonly string[],
  focusParks: readonly ParkId[],
  skip: ReadonlySet<string>,
  rideById: (id: string) => Ride | undefined,
  opts: { excluded?: readonly ExcludedItem[]; fixedParks?: FixedParks },
): Plan {
  const days: DayPlan[] = dates.slice(0, PARK_IDS.length).map((date, i) => {
    const park = order[i] ?? "MK";
    return { date, morningPark: park, eveningPark: park === "AK" ? "EP" : park, items: [] };
  });
  const placed = new Set<string>();
  for (const d of days) placeParkDay(d, pool, placed, { allowB: true });

  // 予備日: 残ったS・Aがいちばん多いパーク
  const reserveDate = dates[PARK_IDS.length];
  if (reserveDate) {
    const left = (p: ParkId): number => pool.filter((e) => !placed.has(e.ride.id) && e.rank !== "B" && e.ride.park === p && e.ride.kind !== "dining").reduce((s, e) => s + RANK_WEIGHT[e.rank], 0);
    // 残りがなければ、Sがいちばん多いパーク（もう一度乗る・取りこぼし回収の日）
    const sCount = (p: ParkId): number => pool.filter((e) => e.rank === "S" && e.ride.park === p && e.ride.kind !== "dining").length;
    // 本命パークは、残りが同じなら優先（本命の取りこぼし回収・もう一度乗る）
    const focusBonus = (p: ParkId): number => (focusParks.includes(p) ? PARK_IDS.length - focusParks.indexOf(p) : 0);
    const park = opts.fixedParks?.[reserveDate] ?? [...PARK_IDS].sort((a, b) => left(b) - left(a) || focusBonus(b) - focusBonus(a) || sCount(b) - sCount(a))[0] ?? "MK";
    const reserve: DayPlan = { date: reserveDate, morningPark: park, eveningPark: park, items: [] };
    placeParkDay(reserve, pool, placed, { allowB: false });
    days.push(reserve);
  }

  placeDining(days, pool, placed);

  // パレードはマジックキングダムの日に1つ
  const mk = days.find((d) => d.morningPark === "MK");
  const hasParade = days.some((d) => d.items.some((i) => rideById(i.rideId)?.kind === "parade"));
  if (mk && !hasParade && !skip.has("festival-of-fantasy") && rideById("festival-of-fantasy")) mk.items.push({ rideId: "festival-of-fantasy", slot: "pm", method: "show", suggested: true });

  return {
    days: days.map((d) => ({ ...d, items: sortItems(d.items) })),
    updatedBy: null,
    updatedAt: null,
    ...(opts.fixedParks && Object.keys(opts.fixedParks).length > 0 ? { fixedParks: { ...opts.fixedParks } } : {}),
    ...(focusParks.length > 0 ? { focusParks: [...focusParks] } : {}),
    ...(opts.excluded && opts.excluded.length > 0 ? { excluded: [...opts.excluded] } : {}),
  };
}

/** 合意リストのうち、どの日にも置かれていないもの（自分たちで外したものは除く） */
export function unplaced(plan: Plan, consensus: readonly ConsensusItem[]): ConsensusItem[] {
  const ids = new Set(plan.days.flatMap((d) => d.items.map((i) => i.rideId)));
  const out = new Set((plan.excluded ?? []).map((e) => e.rideId));
  return consensus.filter((c) => !ids.has(c.rideId) && !out.has(c.rideId));
}

/** 1つの項目を別の日・枠・乗り方に動かす（日の中の並びは時間の枠の順） */
export function moveItem(plan: Plan, rideId: string, to: { date: string; slot: Slot; method: Method }, opts: { pin?: boolean } = {}): Plan {
  let found: PlanItem | undefined;
  const days = plan.days.map((d) => {
    const hit = d.items.find((i) => i.rideId === rideId);
    if (hit) found = hit;
    return hit ? { ...d, items: d.items.filter((i) => i.rideId !== rideId) } : d;
  });
  const { pinned: wasPinned, ...base } = found ?? { pinned: undefined };
  // 手で午前／午後を選んだら固定。そうでなければ、同じ枠にとどまるときだけ固定を引き継ぐ
  const pin = (to.slot === "am" || to.slot === "pm") && (opts.pin === true || (wasPinned === true && found?.slot === to.slot));
  const item: PlanItem = { ...base, rideId, slot: to.slot, method: to.method, ...(pin ? { pinned: true as const } : {}) };
  const excluded = (plan.excluded ?? []).filter((e) => e.rideId !== rideId);
  return { ...withExcluded(plan, excluded), days: days.map((d) => (d.date === to.date ? { ...d, items: sortItems([...d.items, item]) } : d)) };
}

/** お土産を見る時間として選べる分（プルダウン） */
export const SHOP_OPTIONS = [5, 10, 15, 20, 25, 30] as const;
const isShop = (v: unknown): v is number => typeof v === "number" && (SHOP_OPTIONS as readonly number[]).includes(v);

/** その日のその予定の後に、お土産を見る時間を決める（0 で なし） */
export const setShop = (plan: Plan, date: string, rideId: string, minutes: number): Plan => ({
  ...plan,
  days: plan.days.map((d) =>
    d.date !== date
      ? d
      : {
          ...d,
          items: d.items.map((i) => {
            if (i.rideId !== rideId) return i;
            const { shop: _old, ...rest } = i;
            return isShop(minutes) ? { ...rest, shop: minutes } : rest;
          }),
        },
  ),
});

/** 予定の後の余裕として選べる分（プルダウン。5〜120分の5分刻み） */
export const BUFFER_OPTIONS: readonly number[] = Array.from({ length: 24 }, (_, i) => (i + 1) * 5);
export const DEFAULT_BUFFER = 5;
const isBuffer = (v: unknown): v is number => typeof v === "number" && BUFFER_OPTIONS.includes(v);

/** その日のその予定の後の余裕を決める（既定の5分なら記録しない） */
export const setBuffer = (plan: Plan, date: string, rideId: string, minutes: number): Plan => ({
  ...plan,
  days: plan.days.map((d) => (d.date !== date ? d : { ...d, items: d.items.map((i) => (i.rideId === rideId ? withBuffer(i, minutes) : i)) })),
});

/** すべての予定の後の余裕を、まとめて同じ分にする */
export const setBufferAll = (plan: Plan, minutes: number): Plan => ({
  ...plan,
  days: plan.days.map((d) => ({ ...d, items: d.items.map((i) => withBuffer(i, minutes)) })),
});

const withBuffer = (i: PlanItem, minutes: number): PlanItem => {
  const { buffer: _old, ...rest } = i;
  return isBuffer(minutes) && minutes !== DEFAULT_BUFFER ? { ...rest, buffer: minutes } : rest;
};

/** 手で決めた午前／午後の固定を外す（自動の「近い順」に任せる） */
export const unpinItem = (plan: Plan, rideId: string): Plan => ({
  ...plan,
  days: plan.days.map((d) => ({ ...d, items: d.items.map((i) => (i.rideId === rideId && i.pinned ? (({ pinned: _p, ...rest }) => rest)(i) : i)) })),
});

export const withKept = (plan: Plan, kept: string[]): Plan => {
  const { keptLow: _old, ...rest } = plan;
  return kept.length > 0 ? { ...rest, keptLow: kept } : rest;
};

const withExcluded = (plan: Plan, excluded: ExcludedItem[]): Plan => {
  const { excluded: _old, ...rest } = plan;
  return excluded.length > 0 ? { ...rest, excluded } : rest;
};

/** まとめて外す（外したものは「外したもの」に記録し、あとで元の日・時間に戻せる） */
export function removeItems(plan: Plan, rideIds: ReadonlySet<string>, date?: string, by: PersonId | null = null): Plan {
  const at = Date.now();
  const removed: ExcludedItem[] = [];
  const days = plan.days.map((d) => {
    if (date && d.date !== date) return d;
    const hit = d.items.filter((i) => rideIds.has(i.rideId));
    removed.push(...hit.map((i) => ({ ...i, date: d.date, by, at })));
    return hit.length > 0 ? { ...d, items: d.items.filter((i) => !rideIds.has(i.rideId)) } : d;
  });
  const keep = (plan.excluded ?? []).filter((e) => !removed.some((r) => r.rideId === e.rideId));
  return withKept({ ...withExcluded(plan, [...keep, ...removed]), days }, (plan.keptLow ?? []).filter((id) => !rideIds.has(id)));
}

export const removeItem = (plan: Plan, rideId: string, by: PersonId | null = null): Plan => removeItems(plan, new Set([rideId]), undefined, by);

/**
 * 外したものを元の日・時間・乗り方に戻す。作り直しなどで元の日のパークが変わっていたら、
 * そのアトラクションのパークの日に戻す（なければ元の日）
 */
export function restoreItem(plan: Plan, rideId: string, parkOf?: (id: string) => ParkId | undefined): Plan {
  const ex = (plan.excluded ?? []).find((e) => e.rideId === rideId);
  if (!ex) return plan;
  const park = parkOf?.(rideId);
  const fits = (d: DayPlan): boolean => !park || d.morningPark === park || d.eveningPark === park;
  const original = plan.days.find((d) => d.date === ex.date);
  const target = (original && fits(original) ? original : plan.days.find(fits)) ?? original ?? plan.days[0];
  const rest = (plan.excluded ?? []).filter((e) => e.rideId !== rideId);
  if (!target) return withExcluded(plan, rest);
  const item: PlanItem = { rideId, slot: target.date === ex.date || ex.method === "meal" || ex.method === "show" ? ex.slot : "am", method: ex.method, ...(ex.suggested ? { suggested: true } : {}) };
  return {
    ...withExcluded(plan, rest),
    days: plan.days.map((d) => (d.date === target.date ? { ...d, items: sortItems([...d.items.filter((i) => i.rideId !== rideId), item]) } : d)),
  };
}

export const setDayParks = (plan: Plan, date: string, parks: { morningPark: ParkId; eveningPark: ParkId }): Plan => ({
  ...plan,
  days: plan.days.map((d) => (d.date === date ? { ...d, ...parks } : d)),
});

/** その日に Multi Pass を買う必要があるか */
export const needsMultiPass = (d: DayPlan): boolean => d.items.some((i) => i.method === "multi" || i.method === "multiExtra");

const SLOTS = new Set<string>(SLOT_ORDER);
const METHODS = new Set<string>(["early", "single", "multi", "multiExtra", "singleRider", "standby", "show", "meal"]);
const PARKS = new Set<string>(PARK_IDS);
const isPark = (v: unknown): v is ParkId => typeof v === "string" && PARKS.has(v);

/** 保存データを読み直す（壊れた項目は捨てる） */
export function parsePlan(data: unknown): Plan {
  if (typeof data !== "object" || data === null) return emptyPlan();
  const d = data as Record<string, unknown>;
  const days = Array.isArray(d.days)
    ? d.days.flatMap((x: unknown): DayPlan[] => {
        if (typeof x !== "object" || x === null) return [];
        const day = x as Record<string, unknown>;
        if (typeof day.date !== "string" || !isPark(day.morningPark) || !isPark(day.eveningPark)) return [];
        const items = Array.isArray(day.items)
          ? day.items.flatMap((y: unknown): PlanItem[] => {
              if (typeof y !== "object" || y === null) return [];
              const it = y as Record<string, unknown>;
              if (typeof it.rideId !== "string" || typeof it.slot !== "string" || !SLOTS.has(it.slot) || typeof it.method !== "string" || !METHODS.has(it.method)) return [];
              return [
                {
                  rideId: it.rideId,
                  slot: it.slot as Slot,
                  method: it.method as Method,
                  ...(it.suggested === true ? { suggested: true } : {}),
                  ...(it.pinned === true ? { pinned: true as const } : {}),
                  ...(isShop(it.shop) ? { shop: it.shop } : {}),
                  ...(isBuffer(it.buffer) ? { buffer: it.buffer } : {}),
                },
              ];
            })
          : [];
        return [{ date: day.date, morningPark: day.morningPark, eveningPark: day.eveningPark, items }];
      })
    : [];
  const excluded = Array.isArray(d.excluded)
    ? d.excluded.flatMap((y: unknown): ExcludedItem[] => {
        if (typeof y !== "object" || y === null) return [];
        const e = y as Record<string, unknown>;
        if (typeof e.rideId !== "string" || typeof e.date !== "string" || typeof e.slot !== "string" || !SLOTS.has(e.slot) || typeof e.method !== "string" || !METHODS.has(e.method)) return [];
        return [
          {
            rideId: e.rideId,
            date: e.date,
            slot: e.slot as Slot,
            method: e.method as Method,
            by: e.by === "toshi" || e.by === "tsuma" ? e.by : null,
            at: typeof e.at === "number" ? e.at : 0,
            ...(e.suggested === true ? { suggested: true } : {}),
          },
        ];
      })
    : [];
  // 以前の形式（本命パーク1つ: focusPark）も読める
  const focusParks: ParkId[] = Array.isArray(d.focusParks) ? d.focusParks.filter(isPark).filter((p: ParkId, k: number, a: ParkId[]) => a.indexOf(p) === k) : isPark(d.focusPark) ? [d.focusPark] : [];
  return {
    days,
    ...(excluded.length > 0 ? { excluded } : {}),
    ...(focusParks.length > 0 ? { focusParks } : {}),
    ...(d.dropLow === true ? { dropLow: true as const } : {}),
    ...(() => {
      const raw = typeof d.fixedParks === "object" && d.fixedParks !== null ? (d.fixedParks as Record<string, unknown>) : {};
      const fp: FixedParks = {};
      for (const [k, v] of Object.entries(raw)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isPark(v)) fp[k] = v;
      return Object.keys(fp).length > 0 ? { fixedParks: fp } : {};
    })(),
    ...(Array.isArray(d.keptLow) && d.keptLow.some((x: unknown) => typeof x === "string") ? { keptLow: d.keptLow.filter((x: unknown): x is string => typeof x === "string") } : {}),
    updatedBy: d.updatedBy === "toshi" || d.updatedBy === "tsuma" ? d.updatedBy : null,
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : null,
  };
}
