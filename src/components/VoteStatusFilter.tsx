import { VOTE_LABELS } from "../lib/consensus";
import { toggle } from "../lib/filters";
import { VOTE_STATUSES, type VoteStatus } from "../lib/voteFilter";

const LABEL: Record<VoteStatus, string> = { ...VOTE_LABELS, none: "未回答" };

interface Props {
  value: ReadonlySet<VoteStatus>;
  onChange: (v: Set<VoteStatus>) => void;
  /** ほかの絞り込みを効かせたうえでの件数 */
  counts: Record<VoteStatus, number>;
}

/** 自分の回答（絶対乗る〜乗らない・未回答）で絞り込む。複数選ぶと「どれか」 */
export function VoteStatusFilter({ value, onChange, counts }: Props) {
  return (
    <div className="vote-status">
      <span className="vote-status-label">あなたの回答</span>
      <div className="chips wrap" role="group" aria-label="自分の回答で絞り込む（複数選ぶと、どれかに当てはまるもの）">
        {VOTE_STATUSES.map((s) => (
          <button key={s} aria-pressed={value.has(s)} className={`chip vs vs-${s}${value.has(s) ? " on" : ""}`} onClick={() => onChange(toggle(value, s))}>
            <span className="vs-dot" aria-hidden="true" />
            {LABEL[s]}
            <span className="vs-num">{counts[s]}</span>
          </button>
        ))}
        {value.size > 0 && (
          <button className="chip clear" onClick={() => onChange(new Set())}>
            回答の絞り込みをクリア
          </button>
        )}
      </div>
    </div>
  );
}
