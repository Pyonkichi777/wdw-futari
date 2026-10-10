export type ParkId = "MK" | "EP" | "HS" | "AK";

/** 優先パスの種類（2026年9月時点。出発前に再検証する） */
export type LightningLane = "single" | "multi" | "none";

export type Intensity = "弱い" | "中" | "強い";

export type Tag = "落下" | "高速" | "回転" | "後ろ向き" | "3D・酔いやすい" | "暗い" | "濡れる" | "ショー";

export interface Ride {
  id: string;
  nameJa: string;
  nameEn: string;
  park: ParkId;
  /** 身長制限（cm）。なしは null */
  minHeightCm: number | null;
  intensity: Intensity;
  tags: readonly Tag[];
  lightningLane: LightningLane;
  singleRider: boolean;
  /** 東京ディズニーリゾートにも同じものがあるか */
  inTokyo: boolean;
  description: string;
  /** 「乗らなかったら後悔するTOP10」の順位（2026-09-23作成） */
  top10?: number;
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
