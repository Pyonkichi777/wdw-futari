export type ParkId = "MK" | "EP" | "HS" | "AK";

/** 優先パスの種類（2026年9月時点。出発前に再検証する） */
export type LightningLane = "single" | "multi" | "none";

export type Intensity = "弱い" | "中" | "強い";

/** 種類: 乗り物・ショー・パレード・夜のショー・散策・グリーティング */
export type RideKind = "ride" | "show" | "parade" | "night" | "walk" | "greet" | "dining";

/** 食事の時間帯 */
export type MealPeriod = "breakfast" | "lunch" | "dinner";

/** キャラクターダイニングの詳細（kind が "dining" のときだけ） */
export interface DiningInfo {
  /** パークの中の店か（false = ホテルの中。park はそのホテルから行きやすいパーク＝計画上のエリア） */
  inPark: boolean;
  /** 場所（ホテル名やパーク内のエリア） */
  place: string;
  /** キャラクターが出てくる食事の時間帯 */
  meals: readonly MealPeriod[];
  characters: string;
  style: "buffet" | "family" | "set";
  /** 公式サイトの価格帯（大人1人） */
  price: "$$$" | "$$$$";
  /** 予約: disney = ディズニーの予約（60日前から）／hotel = ホテル側で予約 */
  booking: "disney" | "hotel";
  /** 当日の空き待ちリスト（Walk-up List）に対応しているか */
  walkUp: boolean;
  /** ポップセンチュリーからの行き方 */
  access: string;
}

/** グリーティングの会い方: always = 決まった時間帯ずっと／timed = 時刻を決めて登場／roaming = 歩き回っている */
export type GreetStyle = "always" | "timed" | "roaming";

export type Tag = "落下" | "高速" | "回転" | "後ろ向き" | "3D・酔いやすい" | "暗い" | "濡れる" | "ショー";

export interface Ride {
  id: string;
  nameJa: string;
  nameEn: string;
  park: ParkId;
  kind: RideKind;
  /** 身長制限（cm）。なしは null */
  minHeightCm: number | null;
  intensity: Intensity;
  tags: readonly Tag[];
  lightningLane: LightningLane;
  /**
   * Multi Pass のグループ（MK・EPCOT・スタジオのみ）。
   * 1 = 人気グループ：事前予約の3本のうち、このグループからは1日1つまで
   */
  multiPassTier?: 1 | 2;
  singleRider: boolean;
  /** 東京ディズニーリゾートにも同じものがあるか */
  inTokyo: boolean;
  /** 直営ホテル宿泊者の「開園前入園（30分前）」の対象か（2026-10時点） */
  earlyEntry: boolean;
  description: string;
  /** 「乗らなかったら後悔するTOP10」の順位（2026-09-23作成） */
  top10?: number;
  /** ディズニー公式サイトのページ（disneyworld.disney.go.com 以下のパス） */
  officialPath: string;
  /** 改装・閉鎖予定など、出発前に確認が必要な事項 */
  caution?: string;
  /** グリーティングのときだけ: 会えるキャラクターと会い方 */
  greet?: { characters: string; style: GreetStyle };
  /** キャラクターダイニングのときだけ */
  dining?: DiningInfo;
}

export interface Park {
  id: ParkId;
  nameJa: string;
  nameEn: string;
}

/** 2人の呼び名。メールアドレスなどの個人情報はコードに持たない */
export type PersonId = "toshi" | "tsuma";

export type VoteLevel = "must" | "want" | "either" | "skip";

export type Votes = Partial<Record<string, VoteLevel>>;

/** レストランに「行くならいつ」の希望（複数可）。キーはレストランのid */
export type MealPrefs = Partial<Record<string, readonly MealPeriod[]>>;

export type Rank = "S" | "A" | "B";

export interface ConsensusItem {
  rideId: string;
  rank: Rank;
  /** レストランのとき: 2人で決めた食事の時間帯（日ごとの計画で使う） */
  meal?: MealPeriod;
}

export interface Consensus {
  items: ConsensusItem[];
  confirmed: boolean;
  updatedBy: PersonId | null;
  updatedAt: number | null;
}

/** 口コミの評価（TripAdvisor）。数値が取れなかったものは null */
export interface Review {
  /** ★の平均（5点満点） */
  rating: number | null;
  /** 口コミ件数 */
  count: number | null;
  /** 内訳 [とても良い, 良い, 普通, 悪い, とても悪い] の件数 */
  breakdown: [number, number, number, number, number] | null;
  url: string;
  /** 口コミの総評（日本語でひとこと） */
  summary: string;
  /** 注意書き（旧版の評価など） */
  note?: string;
}

/** 酔い度 0=なし 1=低 2=中 3=高 4=最高（目安） */
export type MotionLevel = 0 | 1 | 2 | 3 | 4;

export interface Motion {
  level: MotionLevel;
  /** allears = All Ears の評価を換算 / estimate = 乗り物の動きと口コミから推定 */
  source: "allears" | "estimate";
  /** All Ears の評価の原文（Low / Medium / High / EXTREME など） */
  allEars?: string;
  note?: string;
}
