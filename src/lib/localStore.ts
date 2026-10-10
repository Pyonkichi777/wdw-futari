import type { Consensus, PersonId, VoteLevel } from "../types";
import { emptyConsensus, emptyVotes, type AllVotes } from "./consensus";
import type { Store, Unsubscribe } from "./store";

const VOTES_KEY = "wdw-futari:demo:votes";
const CONSENSUS_KEY = "wdw-futari:demo:consensus";

function read<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback();
  } catch {
    return fallback();
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できない環境（プライベートブラウズ等）では、画面上の状態だけで動く
  }
}

/** お試しモード用。データはこの端末のブラウザにだけ保存される（2人の同期はしない） */
export function createLocalStore(): Store {
  let votes: AllVotes = read(VOTES_KEY, emptyVotes);
  let consensus: Consensus = read(CONSENSUS_KEY, emptyConsensus);
  const voteListeners = new Set<(v: AllVotes) => void>();
  const consensusListeners = new Set<(c: Consensus) => void>();

  const listen = <T>(set: Set<(v: T) => void>, cb: (v: T) => void, current: T): Unsubscribe => {
    set.add(cb);
    cb(current);
    return () => set.delete(cb);
  };

  return {
    subscribeVotes: (cb) => listen(voteListeners, cb, votes),
    async setVote(person: PersonId, rideId: string, level: VoteLevel) {
      votes = { ...votes, [person]: { ...votes[person], [rideId]: level } };
      write(VOTES_KEY, votes);
      voteListeners.forEach((l) => l(votes));
    },
    async setVotes(person: PersonId, rideIds: readonly string[], level: VoteLevel) {
      const next = { ...votes[person] };
      for (const id of rideIds) next[id] = level;
      votes = { ...votes, [person]: next };
      write(VOTES_KEY, votes);
      voteListeners.forEach((l) => l(votes));
    },
    subscribeConsensus: (cb) => listen(consensusListeners, cb, consensus),
    async saveConsensus(c: Consensus) {
      consensus = c;
      write(CONSENSUS_KEY, consensus);
      consensusListeners.forEach((l) => l(consensus));
    },
  };
}
