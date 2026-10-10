export type ParkId = "MK" | "EP" | "HS" | "AK";

/** 優先パスの種類（2026年9月時点。出発前に再検証する） */
export type LightningLane = "single" | "multi" | "none";

export type Intensity = "弱い" | "中" | "強い";

/** 種類: 乗り物・ショー・パレード・夜のショー・散策 */
export type RideKind = "ride" | "show" | "parade" | "night" | "walk";

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

export type Rank = "S" | "A" | "B";

export interface ConsensusItem {
  rideId: string;
  rank: Rank;
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
