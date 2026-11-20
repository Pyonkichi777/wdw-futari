import type { Consensus, MealPeriod, PersonId, VoteLevel } from "../types";
import type { AllVotes } from "./consensus";
import type { AllMeals } from "./meals";
import type { Plan } from "./plan";
import type { Checks, GotTime } from "./checks";
import type { PlanSnapshot } from "./snapshots";

export type Unsubscribe = () => void;

/** 2人で共有するデータの保存先。Firestore版とお試し（端末内）版がある */
export interface Store {
  subscribeVotes(cb: (all: AllVotes) => void): Unsubscribe;
  setVote(person: PersonId, rideId: string, level: VoteLevel): Promise<void>;
  setVotes(person: PersonId, rideIds: readonly string[], level: VoteLevel): Promise<void>;
  /** レストランに「行くならいつ」の希望（投票と同じ場所に保存） */
  subscribeMeals(cb: (all: AllMeals) => void): Unsubscribe;
  setMeals(person: PersonId, rideId: string, meals: readonly MealPeriod[]): Promise<void>;
  subscribeConsensus(cb: (c: Consensus) => void): Unsubscribe;
  saveConsensus(c: Consensus): Promise<void>;
  /** 5日間の作戦（2人で共有） */
  /** pending = 自分の変更がまだサーバーに届いていない（電波待ち） */
  subscribePlan(cb: (p: Plan, pending: boolean, fromCache: boolean) => void): Unsubscribe;
  /**
   * 確認した版と最新の作戦が一致するときだけ変更する。競合・通信断では失敗を返す。
   * 圏外で作戦全体を送信待ちにすると、相手の変更を消すため、共有作戦はオンラインで変更する。
   */
  updatePlan(change: (p: Plan) => Plan): Promise<void>;
  /** 予約・購入の「済」チェック（2人で共有） */
  subscribeChecks(cb: (c: Checks) => void): Unsubscribe;
  setCheck(id: string, done: boolean, by: PersonId): Promise<void>;
  /** 取れた予約の時刻（"HH:MM"、null で消す）。入れると「済」にもなる */
  setGotTime(id: string, rideId: string, hm: GotTime | null, by: PersonId, expected?: GotTime | null): Promise<void>;
  /** 作戦の保存（2人それぞれが持つ。2人合計10件まで。新しい順） */
  subscribeSnapshots(cb: (list: PlanSnapshot[]) => void): Unsubscribe;
  /** 上限なら replaceOldestOwn のときだけ自分のいちばん古い保存と入れ替える。入れ替えられなければ Error("full") */
  saveSnapshot(snap: PlanSnapshot, replaceOldestOwn: boolean): Promise<void>;
  /** 自分の保存だけ削除できる */
  deleteSnapshot(id: string, by: PersonId): Promise<void>;
  /** バナー写真（JPEGのdata URL）。2人だけが見られる場所に保存する。null は未設定 */
  subscribeBanner(cb: (dataUrl: string | null) => void): Unsubscribe;
  saveBanner(dataUrl: string | null): Promise<void>;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  /** メール/パスワードでログインした人は、確認メールのリンクを押すまで false */
  verified: boolean;
  provider: "google" | "password" | "demo";
}

export const PERSON_LABEL: Record<PersonId, string> = { toshi: "Toshi", tsuma: "妻" };

export const partnerOf = (p: PersonId): PersonId => (p === "toshi" ? "tsuma" : "toshi");
