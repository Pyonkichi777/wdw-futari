import type { Consensus, PersonId, VoteLevel } from "../types";
import type { AllVotes } from "./consensus";

export type Unsubscribe = () => void;

/** 2人で共有するデータの保存先。Firestore版とお試し（端末内）版がある */
export interface Store {
  subscribeVotes(cb: (all: AllVotes) => void): Unsubscribe;
  setVote(person: PersonId, rideId: string, level: VoteLevel): Promise<void>;
  subscribeConsensus(cb: (c: Consensus) => void): Unsubscribe;
  saveConsensus(c: Consensus): Promise<void>;
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
