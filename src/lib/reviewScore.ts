import type { Review } from "../types";

/** これ未満の件数は「参考値」と表示する */
export const MIN_RELIABLE_COUNT = 30;
/** これ未満の件数は★を出さない（1〜2件では意味がないため） */
export const MIN_SHOWN_COUNT = 5;

export type Verdict = "絶賛" | "高評価" | "好評" | "賛否両論" | "低評価";

export interface ReviewScore {
  /** ★の平均（表示しない場合は null） */
  rating: number | null;
  count: number | null;
  /** 高評価率（「とても良い」+「良い」の割合、%） */
  positivePct: number | null;
  /** 総評の段階（★から機械的に決める） */
  verdict: Verdict | null;
  /** 件数が少なく参考値 */
  lowConfidence: boolean;
}

/** ★の平均から総評の段階を決める */
export function verdictOf(rating: number): Verdict {
  if (rating >= 4.6) return "絶賛";
  if (rating >= 4.2) return "高評価";
  if (rating >= 3.8) return "好評";
  if (rating >= 3.0) return "賛否両論";
  return "低評価";
}

export function scoreOf(review: Review): ReviewScore {
  const enough = review.count !== null && review.count >= MIN_SHOWN_COUNT;
  const rating = enough ? review.rating : null;
  const b = review.breakdown;
  const total = b ? b.reduce((s, n) => s + n, 0) : 0;
  return {
    rating,
    count: review.count,
    positivePct: b && total > 0 && enough ? Math.round(((b[0] + b[1]) / total) * 100) : null,
    verdict: rating !== null ? verdictOf(rating) : null,
    lowConfidence: review.count !== null && review.count < MIN_RELIABLE_COUNT,
  };
}
