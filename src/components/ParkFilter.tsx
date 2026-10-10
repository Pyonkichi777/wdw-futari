import { PARKS } from "../data/parks";
import type { ParkId } from "../types";

export type ParkFilterValue = ParkId | "ALL";

export function ParkFilter({ value, onChange }: { value: ParkFilterValue; onChange: (v: ParkFilterValue) => void }) {
  const options: { id: ParkFilterValue; label: string }[] = [{ id: "ALL", label: "すべて" }, ...PARKS.map((p) => ({ id: p.id, label: p.nameJa }))];
  return (
    <div className="chips" role="tablist" aria-label="パークで絞り込む">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={value === o.id ? "chip on" : "chip"} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
