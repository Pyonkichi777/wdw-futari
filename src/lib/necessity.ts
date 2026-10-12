import type { AllVotes } from "./consensus";

/** 2人の回答から見た「必須度」: both = 2人とも「絶対」／one = どちらか1人が「絶対」／none = 「絶対」と答えた人はいない */
export type Necessity = "both" | "one" | "none";

export const NECESSITY_LABEL: Record<Necessity, string> = {
  both: "必須（2人とも「絶対」と回答）",
  one: "ほぼ必須（1人が「絶対」と回答）",
  none: "できれば（2人とも「乗りたい」か「どちらでも」）",
};

/** 複数のアトラクションに関わるもの（Multi Passの日など）は、いちばん強いものに合わせる */
export function necessityOf(rideIds: readonly string[], votes: AllVotes): Necessity {
  let best: Necessity = "none";
  for (const id of rideIds) {
    const n = Number(votes.toshi[id] === "must") + Number(votes.tsuma[id] === "must");
    if (n === 2) return "both";
    if (n === 1) best = "one";
  }
  return best;
}
