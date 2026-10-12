import type { Consensus, MealPeriod, PersonId, VoteLevel } from "../types";
import type { AllVotes } from "./consensus";
import type { AllMeals } from "./meals";
import type { Plan } from "./plan";
import type { Checks } from "./checks";

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
  subscribePlan(cb: (p: Plan, pending: boolean) => void): Unsubscribe;
  /**
   * 作戦を変える。いちばん新しい作戦（相手の変更を含む）に対して change を当てて保存するので、
   * 2人が同時に操作しても相手の変更を消さない。圏外のときは端末に保存し、つながったら送る
   */
  updatePlan(change: (p: Plan) => Plan): Promise<void>;
  /** 予約・購入の「済」チェック（2人で共有） */
  subscribeChecks(cb: (c: Checks) => void): Unsubscribe;
  setCheck(id: string, done: boolean, by: PersonId): Promise<void>;
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
