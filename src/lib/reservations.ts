import { TRIP } from "../data/trip";
import type { Ride } from "../types";
import { bookingOpensAt, bookingOpensJst, jstText, lightningLaneOpensAt, lightningLaneOpensJst } from "./dining";
import type { Plan } from "./plan";

/** 事前に予約・購入が必要なもの（作戦から自動で作る） */
export interface ReservationTask {
  id: string;
  title: string;
  detail: string;
  /** いつから予約・購入できるか（日本時間の文字列） */
  opens: string;
  /** singleOptional = 朝イチで乗る予定だが、確実にしたいなら Single Pass も買う（任意・保険） */
  kind: "prep" | "dining" | "multi" | "single" | "singleOptional";
  /** 関係するアトラクション（2人の回答で「必須かどうか」を判断する） */
  rideIds: string[];
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
        rideIds: multi.map((r) => r.id),
        detail: multi.length > 0 ? `事前予約: ${multi.map((r) => `${r.multiPassTier === 1 && r.park !== "AK" ? "★" : ""}${r.nameJa}`).join("、")}` : "事前予約なし（当日の追加予約用）",
        opens: llOpens,
      });
    }
    for (const it of d.items) {
      const r = rideById(it.rideId);
      if (!r) continue;
      if (it.method === "single") {
        out.push({ id: `sp:${d.date}:${r.id}`, kind: "single", rideIds: [r.id], title: `${md(d.date)} Single Pass を買う: ${r.nameJa}`, detail: "1本ずつ有料。売り切れることがあるので予約開始と同時に", opens: llOpens });
      }
      if (it.method === "early" && r.lightningLane === "single") {
        out.push({
          id: `spo:${d.date}:${r.id}`,
          kind: "singleOptional",
          rideIds: [r.id],
          title: `（任意）${md(d.date)} 保険の Single Pass: ${r.nameJa}`,
          detail: "朝イチ（開園前入園）で乗る予定なので必須ではない。故障で朝イチに乗れなかったときの保険に、確実にしたいなら買っておく（有料）",
          opens: llOpens,
        });
      }
      if (it.method === "meal" && r.dining && r.dining.booking !== "none") {
        out.push({
          id: `dine:${d.date}:${r.id}`,
          kind: "dining",
          rideIds: [r.id],
          title: `${md(d.date)} ${MEAL[it.slot] ?? "食事"}の予約: ${r.nameJa}`,
          detail: r.dining.booking === "hotel" ? "ホテル側で予約（方法は公式ページで確認）" : "公式アプリ「My Disney Experience」で予約。2人分",
          opens: r.dining.booking === "hotel" ? "ホテルの予約受付しだい" : `${bookingOpensJst(TRIP.checkIn)}（日本時間）`,
        });
      }
    }
  }
  // 予約が早く始まるもの（レストラン）から
  const order = { prep: -1, dining: 0, multi: 1, single: 2, singleOptional: 3 } as const;
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}

/** 取りにくいことで知られる店（一般的な傾向）。予約開始と同時に、ほかより先に押さえる */
const HARD_TO_BOOK = new Set(["dine-cinderella-royal-table", "park-space-220", "park-beak-and-barrel", "dine-topolino", "dine-ohana", "park-be-our-guest", "dine-1900-park-fare", "dine-chef-mickeys"]);
export const isHardToBook = (id: string): boolean => HARD_TO_BOOK.has(id);

/** 予約の段取りの1段階（この順に進める） */
export interface BookingStep {
  id: "prep" | "dining" | "hotel" | "ll" | "dayOf";
  title: string;
  /** いつやるか（表示用） */
  when: string;
  /** 始まる日時（カウントダウン用。決まっていなければ null） */
  at: Date | null;
  /** やり方のコツ */
  tips: string[];
  /** チェックできる項目（この順番で予約する） */
  tasks: ReservationTask[];
  /** チェックのいらない覚え書き（当日の追加予約など） */
  notes: string[];
}

const PREP_TASKS: ReservationTask[] = [
  { id: "prep:account", kind: "prep", rideIds: [], opens: "", title: "公式アプリ「My Disney Experience」に2人ともアカウントを作り、「家族と友人」でつなぐ", detail: "つないでおくと、どちらか1人のスマホで2人分を予約・購入できる" },
  { id: "prep:link", kind: "prep", rideIds: [], opens: "", title: "ホテル（ポップセンチュリー）の予約とパークチケットを、アプリに登録する", detail: "ホテル宿泊者の「早い予約枠」（食事は滞在全日分、時短パスも全日分を7日前から）を使うために必要" },
  { id: "prep:card", kind: "prep", rideIds: [], opens: "", title: "支払い用のクレジットカードをアプリに登録する", detail: "食事の予約は保証のためにカード情報を入れる店が多い（無断キャンセルは料金がかかる）。時短パスは購入時に支払い" },
];

/**
 * いつ・何を・どの順番で予約するか。
 * ① 準備 → ② 食事（取りにくい店から）→ ③ ホテルのレストラン → ④ 時短パス（Single Pass → Multi Pass → 保険）→ ⑤ 当日
 */
export function bookingSteps(plan: Plan, rideById: (id: string) => Ride | undefined): BookingStep[] {
  const tasks = reservationTasks(plan, rideById);
  const diningAt = bookingOpensAt(TRIP.checkIn);
  const llAt = lightningLaneOpensAt(TRIP.checkIn);
  const rideOf = (t: ReservationTask): string => t.rideIds[0] ?? "";
  const dateOf = (t: ReservationTask): string => t.id.split(":")[1] ?? "";
  const byDate = (a: ReservationTask, b: ReservationTask): number => dateOf(a).localeCompare(dateOf(b));

  const disneyDining = tasks.filter((t) => t.kind === "dining" && rideById(rideOf(t))?.dining?.booking === "disney");
  const hard = (t: ReservationTask): number => (isHardToBook(rideOf(t)) ? 0 : rideById(rideOf(t))?.dining?.characters ? 1 : 2);
  disneyDining.sort((a, b) => hard(a) - hard(b) || byDate(a, b));
  const hotelDining = tasks.filter((t) => t.kind === "dining" && rideById(rideOf(t))?.dining?.booking === "hotel").sort(byDate);
  const ll = [
    ...tasks.filter((t) => t.kind === "single").sort(byDate),
    ...tasks.filter((t) => t.kind === "multi").sort(byDate),
    ...tasks.filter((t) => t.kind === "singleOptional").sort(byDate),
  ];

  const extra = plan.days.flatMap((d) =>
    d.items.filter((i) => i.method === "multiExtra").flatMap((i) => {
      const r = rideById(i.rideId);
      return r ? [`${md(d.date)} ${r.nameJa}（1本使ったら、すぐ次をアプリで予約）`] : [];
    }),
  );

  const steps: BookingStep[] = [
    {
      id: "prep",
      title: "準備（アカウント・登録）",
      when: `${jstText(diningAt)}より前に`,
      at: null,
      tips: ["予約開始の当日にあわてないよう、前の週までに済ませておく"],
      tasks: PREP_TASKS,
      notes: [],
    },
  ];
  if (disneyDining.length > 0) {
    steps.push({
      id: "dining",
      title: "食事の予約（ディズニーのアプリ）",
      when: `${jstText(diningAt)}（日本時間）`,
      at: diningAt,
      tips: [
        "チェックイン60日前に、滞在の全日分（ポップセンチュリーに泊まる日）を一度に予約できる",
        "取りにくい店（🔥）から先に。1件取れたらすぐ次へ",
        "満席でも、出発までの間にキャンセルが出ることが多い。こまめにアプリで空きを確認",
      ],
      tasks: disneyDining,
      notes: [],
    });
  }
  if (hotelDining.length > 0) {
    steps.push({
      id: "hotel",
      title: "ホテルのレストランの予約",
      when: "ホテルの予約受付しだい（公式ページで確認）",
      at: null,
      tips: ["ディズニーではなくホテル側の予約。受付開始の時期は店ごとに違う"],
      tasks: hotelDining,
      notes: [],
    });
  }
  if (ll.length > 0) {
    steps.push({
      id: "ll",
      title: "時短パスの購入・事前予約",
      when: `${jstText(llAt)}（日本時間）`,
      at: llAt,
      tips: [
        "チェックイン7日前に、5日分すべてをまとめて買える（ホテル宿泊者の特典）",
        "先に Single Pass（数が少なく売り切れやすい）→ 次に Multi Pass を日付順に",
        "Multi Pass は★（人気グループ）を先に選び、残り2本を選ぶ",
      ],
      tasks: ll,
      notes: [],
    });
  }
  if (extra.length > 0) {
    steps.push({
      id: "dayOf",
      title: "当日（パークで）",
      when: "各日の朝から",
      at: null,
      tips: ["事前予約の1本目を使ったら（または予約時刻を過ぎたら）、次の1本をアプリで予約できる"],
      tasks: [],
      notes: extra,
    });
  }
  return steps;
}

/** 始まるまでの日数（当日・過ぎていれば 0） */
export const daysUntil = (at: Date, now: Date = new Date()): number => Math.max(0, Math.ceil((at.getTime() - now.getTime()) / 86_400_000));
