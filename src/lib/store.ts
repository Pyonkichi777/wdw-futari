import type { Consensus, MealPeriod, PersonId, VoteLevel } from "../types";
import type { AllVotes } from "./consensus";
import type { AllMeals } from "./meals";
import type { Plan } from "./plan";

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
  subscribePlan(cb: (p: Plan) => void): Unsubscribe;
  savePlan(p: Plan): Promise<void>;
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
