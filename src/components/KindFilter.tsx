import { KIND_LABEL } from "../lib/access";
import type { RideKind } from "../types";

export type KindFilterValue = RideKind | "ALL";

const KINDS: readonly RideKind[] = ["ride", "show", "parade", "night", "walk"];

export function KindFilter({ value, onChange }: { value: KindFilterValue; onChange: (v: KindFilterValue) => void }) {
  const options: { id: KindFilterValue; label: string }[] = [{ id: "ALL", label: "種類すべて" }, ...KINDS.map((k) => ({ id: k, label: KIND_LABEL[k] }))];
  return (
    <div className="chips" role="tablist" aria-label="種類で絞り込む">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={value === o.id ? "chip on" : "chip"} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
