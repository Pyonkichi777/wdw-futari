import { FEATURES, toggle, type FeatureId } from "../lib/filters";

export function FeatureFilter({ value, onChange }: { value: ReadonlySet<FeatureId>; onChange: (v: Set<FeatureId>) => void }) {
  return (
    <div className="chips wrap" role="group" aria-label="条件で絞り込む（複数選ぶと、すべてを満たすもの）">
      {FEATURES.map((f) => (
        <button key={f.id} aria-pressed={value.has(f.id)} className={value.has(f.id) ? "chip on" : "chip"} onClick={() => onChange(toggle(value, f.id))}>
          {value.has(f.id) ? "✓ " : ""}
          {f.label}
        </button>
      ))}
      {value.size > 0 && (
        <button className="chip clear" onClick={() => onChange(new Set())}>
          条件をクリア
        </button>
      )}
    </div>
  );
}
