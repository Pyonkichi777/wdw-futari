/**
 * 旅の予定（2026-10-12 Toshi確定）。日ごとの計画・予約開始日の計算はここを基準にする。
 * 公開リポジトリなので、日付と宿の種類までにとどめる（便名・予約番号・宿の名前以外の詳細は書かない）。
 */
export const TRIP = {
  /** 日本出発 */
  departJapan: "2027-04-29",
  /** ポップセンチュリーのチェックイン（4/29の夜は空港近くのホテル） */
  checkIn: "2027-04-30",
  /** ポップセンチュリーのチェックアウト＝オーランド発（予定） */
  checkOut: "2027-05-06",
  /** パークチケット（5日間パークホッパー）を使う日 */
  parkDays: ["2027-05-01", "2027-05-02", "2027-05-03", "2027-05-04", "2027-05-05"],
  /** 日本帰着 */
  returnJapan: "2027-05-07",
} as const;

export interface TripDay {
  /** 表示用の日付（例: 4/29(木)） */
  date: string;
  plan: string;
  /** その夜の宿。null = 機内・帰国 */
  stay: string | null;
  park: boolean;
}

export const ITINERARY: readonly TripDay[] = [
  { date: "4/29(木・祝)", plan: "日本出発 → オーランド着", stay: "空港近くのホテル", park: false },
  { date: "4/30(金)", plan: "ポップセンチュリーへ移動・チェックイン。パークなし（チケットは5/1から）", stay: "ポップセンチュリー", park: false },
  { date: "5/1(土)", plan: "パーク1日目", stay: "ポップセンチュリー", park: true },
  { date: "5/2(日)", plan: "パーク2日目", stay: "ポップセンチュリー", park: true },
  { date: "5/3(月)", plan: "パーク3日目", stay: "ポップセンチュリー", park: true },
  { date: "5/4(火)", plan: "パーク4日目", stay: "ポップセンチュリー", park: true },
  { date: "5/5(水)", plan: "パーク5日目（チケット最終日）", stay: "ポップセンチュリー", park: true },
  { date: "5/6(木)", plan: "チェックアウト → オーランド発（予定）", stay: null, park: false },
  { date: "5/7(金)", plan: "日本着", stay: null, park: false },
];

/** "2027-04-30" → "4/30" */
export const shortDate = (iso: string): string => {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
};
