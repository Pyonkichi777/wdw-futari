import type { Consensus, MealPeriod, PersonId, VoteLevel } from "../types";
import { emptyConsensus, emptyVotes, type AllVotes } from "./consensus";
import { emptyMeals, type AllMeals } from "./meals";
import { emptyPlan, type Plan } from "./plan";
import type { Checks } from "./checks";
import { addSnapshot, parseSnapshots, removeSnapshot, toStored, type PlanSnapshot } from "./snapshots";
import type { Store, Unsubscribe } from "./store";

const VOTES_KEY = "wdw-futari:demo:votes";
const CONSENSUS_KEY = "wdw-futari:demo:consensus";
const BANNER_KEY = "wdw-futari:demo:banner";
const MEALS_KEY = "wdw-futari:demo:meals";
const PLAN_KEY = "wdw-futari:demo:plan";
const CHECKS_KEY = "wdw-futari:demo:checks";
const SNAP_KEY = "wdw-futari:demo:snapshots";

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
  let meals: AllMeals = read(MEALS_KEY, emptyMeals);
  const mealListeners = new Set<(m: AllMeals) => void>();
  let plan: Plan = read(PLAN_KEY, emptyPlan);
  const planListeners = new Set<(p: Plan) => void>();
  let checks: Checks = read<Checks>(CHECKS_KEY, () => ({}));
  const checkListeners = new Set<(c: Checks) => void>();
  let snaps: PlanSnapshot[] = parseSnapshots(read<unknown>(SNAP_KEY, () => null));
  const snapListeners = new Set<(s: PlanSnapshot[]) => void>();
  let banner: string | null = read<string | null>(BANNER_KEY, () => null);
  const bannerListeners = new Set<(b: string | null) => void>();

  const listen = <T>(set: Set<(v: T) => void>, cb: (v: T) => void, current: T): Unsubscribe => {
    set.add(cb);
    cb(current);
    return () => set.delete(cb);
  };

  // お試しモードでも、同じ端末の別のタブ・ウィンドウと作戦とチェックを同期する
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === PLAN_KEY) {
        plan = read(PLAN_KEY, emptyPlan);
        planListeners.forEach((l) => l(plan));
      }
      if (e.key === SNAP_KEY) {
        snaps = parseSnapshots(read<unknown>(SNAP_KEY, () => null));
        snapListeners.forEach((l) => l(snaps));
      }
      if (e.key === CHECKS_KEY) {
        checks = read<Checks>(CHECKS_KEY, () => ({}));
        checkListeners.forEach((l) => l(checks));
      }
    });
  }

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
    subscribeMeals: (cb) => listen(mealListeners, cb, meals),
    async setMeals(person: PersonId, rideId: string, list: readonly MealPeriod[]) {
      meals = { ...meals, [person]: { ...meals[person], [rideId]: [...list] } };
      write(MEALS_KEY, meals);
      mealListeners.forEach((l) => l(meals));
    },
    subscribeConsensus: (cb) => listen(consensusListeners, cb, consensus),
    async saveConsensus(c: Consensus) {
      consensus = c;
      write(CONSENSUS_KEY, consensus);
      consensusListeners.forEach((l) => l(consensus));
    },
    subscribePlan: (cb) => listen<Plan>(planListeners, (p) => cb(p, false), plan),
    async updatePlan(change: (p: Plan) => Plan) {
      // ほかのタブで変わっていれば、それに当てる
      plan = change(read(PLAN_KEY, emptyPlan));
      write(PLAN_KEY, plan);
      planListeners.forEach((l) => l(plan));
    },
    subscribeSnapshots: (cb) => listen(snapListeners, cb, snaps),
    async saveSnapshot(snap: PlanSnapshot, replaceOldestOwn: boolean) {
      const r = addSnapshot(parseSnapshots(read<unknown>(SNAP_KEY, () => null)), snap, replaceOldestOwn);
      if (!r.ok) throw new Error("full");
      snaps = r.list;
      write(SNAP_KEY, toStored(snaps));
      snapListeners.forEach((l) => l(snaps));
    },
    async deleteSnapshot(id: string, by: PersonId) {
      snaps = removeSnapshot(parseSnapshots(read<unknown>(SNAP_KEY, () => null)), id, by);
      write(SNAP_KEY, toStored(snaps));
      snapListeners.forEach((l) => l(snaps));
    },
    subscribeChecks: (cb) => listen(checkListeners, cb, checks),
    async setCheck(id: string, done: boolean, by: PersonId) {
      const next = { ...checks };
      if (done) next[id] = { by, at: Date.now() };
      else delete next[id];
      checks = next;
      write(CHECKS_KEY, checks);
      checkListeners.forEach((l) => l(checks));
    },
    subscribeBanner: (cb) => listen(bannerListeners, cb, banner),
    async saveBanner(dataUrl: string | null) {
      banner = dataUrl;
      write(BANNER_KEY, banner);
      bannerListeners.forEach((l) => l(banner));
    },
  };
}
