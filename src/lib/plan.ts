import type { ConsensusItem, MealPeriod, ParkId, PersonId, Rank, Ride } from "../types";

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
}

export interface DayPlan {
  /** "2027-05-01" */
  date: string;
  morningPark: ParkId;
  /** 夕方以降のパーク（ホッパー）。朝と同じならホッパーしない */
  eveningPark: ParkId;
  items: PlanItem[];
}

export interface Plan {
  days: DayPlan[];
  /** 本命パーク（いちばん空いている日に置く） */
  focusPark?: ParkId;
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

/**
 * 曜日ごとの混み具合の目安（一般的な傾向: 土 > 日 > 月 > 火・水）。2027年の混雑予想ではないので、
 * 出発前に混雑予想カレンダーで確かめる
 */
export const DAY_CROWD: Record<number, number> = { 0: 4, 1: 3, 2: 2, 3: 2, 4: 2.5, 5: 3.5, 6: 5 };
export const crowdOf = (iso: string): number => DAY_CROWD[new Date(`${iso}T12:00:00Z`).getUTCDay()] ?? 3;

/** 本命パークは、混雑の重みを何倍にして空いている日へ寄せるか */
const FOCUS_FACTOR = 4;

const PARK_IDS: readonly ParkId[] = ["MK", "EP", "HS", "AK"];

/** スター・ウォーズの日（5/4）はハリウッド・スタジオが特に混む */
export const STAR_WARS_DAY = "2027-05-04";

export const isWeekend = (iso: string): boolean => {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

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
 * パークを回る日を決める。4パークを1日ずつ（最終日は予備日）。
 * 重い（S・Aが多い）パークほど週末を避け、ハリウッド・スタジオはスター・ウォーズの日を避ける。
 */
export function chooseParkOrder(entries: readonly Entry[], dates: readonly string[], focusPark?: ParkId): ParkId[] {
  const weight = (p: ParkId): number => entries.filter((e) => e.ride.park === p).reduce((s, e) => s + RANK_WEIGHT[e.rank], 0) + 1;
  const mainDates = dates.slice(0, PARK_IDS.length);
  let best: { order: ParkId[]; cost: number } | null = null;
  for (const order of permutations(PARK_IDS)) {
    let cost = 0;
    order.forEach((park, i) => {
      const date = mainDates[i];
      if (!date) return;
      if (park === "HS" && date === STAR_WARS_DAY) cost += 1000;
      cost += crowdOf(date) * PARK_POPULARITY[park] * weight(park) * (park === focusPark ? FOCUS_FACTOR : 1);
    });
    if (!best || cost < best.cost) best = { order, cost };
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
  opts: { focusPark?: ParkId } = {},
): Plan {
  const pool: Entry[] = consensus.flatMap((c, order): Entry[] => {
    const ride = rideById(c.rideId);
    return ride ? [{ ride, rank: c.rank, ...(c.meal ? { meal: c.meal } : {}), order }] : [];
  });
  pool.sort((a, b) => RANK_WEIGHT[b.rank] - RANK_WEIGHT[a.rank] || a.order - b.order);

  const order = chooseParkOrder(pool, dates, opts.focusPark);
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
    const focusBonus = (p: ParkId): number => (p === opts.focusPark ? 1 : 0);
    const park = [...PARK_IDS].sort((a, b) => left(b) - left(a) || focusBonus(b) - focusBonus(a) || sCount(b) - sCount(a))[0] ?? "MK";
    const reserve: DayPlan = { date: reserveDate, morningPark: park, eveningPark: park, items: [] };
    placeParkDay(reserve, pool, placed, { allowB: false });
    days.push(reserve);
  }

  placeDining(days, pool, placed);

  // パレードはマジックキングダムの日に1つ
  const mk = days.find((d) => d.morningPark === "MK");
  const hasParade = days.some((d) => d.items.some((i) => rideById(i.rideId)?.kind === "parade"));
  if (mk && !hasParade && rideById("festival-of-fantasy")) mk.items.push({ rideId: "festival-of-fantasy", slot: "pm", method: "show", suggested: true });

  return { days: days.map((d) => ({ ...d, items: sortItems(d.items) })), updatedBy: null, updatedAt: null, ...(opts.focusPark ? { focusPark: opts.focusPark } : {}) };
}

/** 合意リストのうち、どの日にも置かれていないもの */
export function unplaced(plan: Plan, consensus: readonly ConsensusItem[]): ConsensusItem[] {
  const ids = new Set(plan.days.flatMap((d) => d.items.map((i) => i.rideId)));
  return consensus.filter((c) => !ids.has(c.rideId));
}

/** 1つの項目を別の日・枠・乗り方に動かす（日の中の並びは時間の枠の順） */
export function moveItem(plan: Plan, rideId: string, to: { date: string; slot: Slot; method: Method }): Plan {
  let found: PlanItem | undefined;
  const days = plan.days.map((d) => {
    const hit = d.items.find((i) => i.rideId === rideId);
    if (hit) found = hit;
    return hit ? { ...d, items: d.items.filter((i) => i.rideId !== rideId) } : d;
  });
  const item: PlanItem = { ...(found ?? {}), rideId, slot: to.slot, method: to.method };
  return { ...plan, days: days.map((d) => (d.date === to.date ? { ...d, items: sortItems([...d.items, item]) } : d)) };
}

export const removeItem = (plan: Plan, rideId: string): Plan => ({
  ...plan,
  days: plan.days.map((d) => ({ ...d, items: d.items.filter((i) => i.rideId !== rideId) })),
});

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
              return [{ rideId: it.rideId, slot: it.slot as Slot, method: it.method as Method, ...(it.suggested === true ? { suggested: true } : {}) }];
            })
          : [];
        return [{ date: day.date, morningPark: day.morningPark, eveningPark: day.eveningPark, items }];
      })
    : [];
  return {
    days,
    ...(isPark(d.focusPark) ? { focusPark: d.focusPark } : {}),
    updatedBy: d.updatedBy === "toshi" || d.updatedBy === "tsuma" ? d.updatedBy : null,
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : null,
  };
}
