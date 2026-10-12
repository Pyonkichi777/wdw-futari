import { useState } from "react";
import { PARKS, parkName } from "../data/parks";
import { rideById } from "../data/rides";
import { ITINERARY, TRIP } from "../data/trip";
import { lightningLaneOpensJst } from "../lib/dining";
import {
  METHOD_LABEL,
  SLOT_LABEL,
  SLOT_ORDER,
  buildPlan,
  moveItem,
  needsMultiPass,
  removeItem,
  setDayParks,
  unplaced,
  type DayPlan,
  type Method,
  type Plan,
  type PlanItem,
  type Slot,
} from "../lib/plan";
import { checkPlan } from "../lib/planChecks";
import type { Consensus, ParkId, PersonId, Rank, Ride } from "../types";

interface Props {
  me: PersonId;
  consensus: Consensus;
  plan: Plan;
  onSave: (p: Plan) => void;
}

const parkDayLabels = ITINERARY.filter((d) => d.park).map((d) => d.date);
const dayLabel = (iso: string): string => parkDayLabels[TRIP.parkDays.indexOf(iso as (typeof TRIP.parkDays)[number])] ?? iso;

/** その項目で選べる乗り方 */
function methodsFor(r: Ride): Method[] {
  if (r.kind === "dining") return ["meal"];
  if (r.kind === "show" || r.kind === "parade" || r.kind === "night") return ["show"];
  if (r.kind !== "ride") return ["standby"];
  const out: Method[] = [];
  if (r.earlyEntry) out.push("early");
  if (r.lightningLane === "single") out.push("single");
  if (r.lightningLane === "multi") out.push("multi", "multiExtra");
  if (r.singleRider) out.push("singleRider");
  out.push("standby");
  return out;
}

/** A5 日割り作戦ボード＋自動チェック＋A7 時短パス段取り表 */
export function PlanScreen({ me, consensus, plan, onSave }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const save = (p: Plan): void => onSave({ ...p, updatedBy: me, updatedAt: Date.now() });
  const rankOf = (id: string): Rank | undefined => consensus.items.find((c) => c.rideId === id)?.rank;

  if (!consensus.confirmed || consensus.items.length === 0) {
    return (
      <section>
        <h2>5日間の作戦</h2>
        <div className="empty-state">
          <p>「合意」タブで合意リストを確定すると、ここで5日間の作戦を作れます。</p>
        </div>
      </section>
    );
  }

  const generate = (): void => save(buildPlan(consensus.items, rideById, TRIP.parkDays));

  if (plan.days.length === 0) {
    return (
      <section>
        <h2>5日間の作戦</h2>
        <div className="empty-state">
          <p>確定した合意リストから、おすすめの5日間の作戦を自動で組みます。そのあと2人で手直しできます。</p>
          <button className="primary wide" onClick={generate}>
            合意リストからおすすめの作戦を作る
          </button>
        </div>
      </section>
    );
  }

  const warnings = checkPlan(plan, consensus.items, rideById);
  const reds = warnings.filter((w) => w.level === "red");
  const left = unplaced(plan, consensus.items);

  return (
    <section className="plan">
      <h2>5日間の作戦</h2>
      {plan.updatedBy && plan.updatedAt && (
        <p className="note">
          最終更新: {plan.updatedBy === "toshi" ? "Toshi" : "妻"}（{new Date(plan.updatedAt).toLocaleString("ja-JP")}）
        </p>
      )}

      <div className={reds.length > 0 ? "plan-check bad" : "plan-check ok"}>
        <p className="plan-check-title">{reds.length > 0 ? `🔴 直すところが${reds.length}件あります` : "✅ 必ず直すところはありません"}</p>
        <ul>
          {warnings.map((w, i) => (
            <li key={i} className={`w-${w.level}`}>
              {w.level === "red" ? "🔴" : "🟡"} {w.message}
            </li>
          ))}
        </ul>
      </div>

      {plan.days.map((d) => (
        <DayCard
          key={d.date}
          day={d}
          rankOf={rankOf}
          editing={editing}
          onEdit={setEditing}
          onParks={(parks) => save(setDayParks(plan, d.date, parks))}
          onMove={(id, to) => {
            save(moveItem(plan, id, to));
            setEditing(null);
          }}
          onRemove={(id) => {
            save(removeItem(plan, id));
            setEditing(null);
          }}
          days={plan.days}
        />
      ))}

      {left.length > 0 && (
        <div className="plan-day">
          <h3>📦 どの日にも入っていないもの（{left.length}件）</h3>
          <ul className="plan-items">
            {left.map((c) => {
              const r = rideById(c.rideId);
              if (!r) return null;
              return (
                <li key={c.rideId}>
                  <ItemRow ride={r} rank={c.rank} item={null} onClick={() => setEditing(editing === r.id ? null : r.id)} />
                  {editing === r.id && (
                    <ItemEditor
                      ride={r}
                      days={plan.days}
                      current={null}
                      onMove={(to) => {
                        save(moveItem(plan, r.id, to));
                        setEditing(null);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <LightningLaneSheet plan={plan} />

      <button
        className="link"
        onClick={() => {
          if (window.confirm("今の作戦を消して、合意リストからおすすめの作戦を作り直します。手で直したところは元に戻ります。よろしいですか？")) generate();
        }}
      >
        おすすめの作戦に作り直す
      </button>
    </section>
  );
}

function DayCard({
  day,
  days,
  rankOf,
  editing,
  onEdit,
  onParks,
  onMove,
  onRemove,
}: {
  day: DayPlan;
  days: readonly DayPlan[];
  rankOf: (id: string) => Rank | undefined;
  editing: string | null;
  onEdit: (id: string | null) => void;
  onParks: (p: { morningPark: ParkId; eveningPark: ParkId }) => void;
  onMove: (id: string, to: { date: string; slot: Slot; method: Method }) => void;
  onRemove: (id: string) => void;
}) {
  const isReserve = day.date === TRIP.parkDays[TRIP.parkDays.length - 1];
  return (
    <div className={`plan-day park-${day.morningPark}`}>
      <div className="plan-day-head">
        <h3>
          {dayLabel(day.date)}
          {isReserve && <span className="plan-tag">予備日</span>}
          {needsMultiPass(day) && <span className="plan-tag mp">Multi Pass</span>}
        </h3>
        <div className="plan-parks">
          <label>
            朝
            <select value={day.morningPark} onChange={(e) => onParks({ morningPark: e.target.value as ParkId, eveningPark: day.eveningPark })}>
              {PARKS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameJa}
                </option>
              ))}
            </select>
          </label>
          <span>→</span>
          <label>
            夕方から
            <select value={day.eveningPark} onChange={(e) => onParks({ morningPark: day.morningPark, eveningPark: e.target.value as ParkId })}>
              {PARKS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameJa}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {SLOT_ORDER.map((slot) => {
        const items = day.items.filter((i) => i.slot === slot);
        if (items.length === 0) return null;
        return (
          <div key={slot} className="plan-slot">
            <p className="plan-slot-label">{SLOT_LABEL[slot]}</p>
            <ul className="plan-items">
              {items.map((it) => {
                const r = rideById(it.rideId);
                if (!r) return null;
                return (
                  <li key={it.rideId}>
                    <ItemRow ride={r} rank={rankOf(r.id)} item={it} hop={r.park !== day.morningPark} onClick={() => onEdit(editing === r.id ? null : r.id)} />
                    {editing === r.id && <ItemEditor ride={r} days={days} current={{ date: day.date, slot: it.slot, method: it.method }} onMove={(to) => onMove(r.id, to)} onRemove={() => onRemove(r.id)} />}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {day.items.length === 0 && <p className="empty">{isReserve ? "予備日です。取りこぼした乗り物の回収や、もう一度乗りたいものに使います。" : "まだ何も入っていません。"}</p>}
    </div>
  );
}

function ItemRow({ ride, rank, item, hop = false, onClick }: { ride: Ride; rank: Rank | undefined; item: PlanItem | null; hop?: boolean; onClick: () => void }) {
  return (
    <button className="plan-item" onClick={onClick}>
      {rank && <span className={`plan-rank rank-${rank}`}>{rank}</span>}
      {item?.suggested && <span className="plan-rank sug">おすすめ</span>}
      <span className="plan-item-name">
        {ride.nameJa}
        {hop && <small>（{parkName(ride.park)}）</small>}
      </span>
      {item && <span className={`plan-method m-${item.method}`}>{METHOD_LABEL[item.method]}</span>}
    </button>
  );
}

function ItemEditor({
  ride,
  days,
  current,
  onMove,
  onRemove,
}: {
  ride: Ride;
  days: readonly DayPlan[];
  current: { date: string; slot: Slot; method: Method } | null;
  onMove: (to: { date: string; slot: Slot; method: Method }) => void;
  onRemove?: () => void;
}) {
  const methods = methodsFor(ride);
  const firstMethod: Method = methods[0] ?? "standby";
  const [date, setDate] = useState(current?.date ?? days[0]?.date ?? "");
  const [slot, setSlot] = useState<Slot>(current?.slot ?? (ride.kind === "dining" ? "dinner" : "am"));
  const [method, setMethod] = useState<Method>(current?.method ?? (methods.includes("standby") ? "standby" : firstMethod));
  return (
    <div className="plan-editor">
      <label>
        日
        <select value={date} onChange={(e) => setDate(e.target.value)}>
          {days.map((d) => (
            <option key={d.date} value={d.date}>
              {dayLabel(d.date)}（{parkName(d.morningPark)}
              {d.eveningPark !== d.morningPark ? `→${parkName(d.eveningPark)}` : ""}）
            </option>
          ))}
        </select>
      </label>
      <label>
        時間
        <select value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
          {SLOT_ORDER.map((s) => (
            <option key={s} value={s}>
              {SLOT_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label>
        乗り方
        <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
          {methods.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <div className="plan-editor-actions">
        <button className="primary" onClick={() => onMove({ date, slot, method })}>
          {current ? "この内容に変える" : "この日に入れる"}
        </button>
        {onRemove && (
          <button className="mini danger" onClick={onRemove}>
            作戦から外す
          </button>
        )}
      </div>
    </div>
  );
}

/** A7 時短パス段取り表（作戦から自動で作る） */
function LightningLaneSheet({ plan }: { plan: Plan }) {
  const rows = plan.days
    .map((d) => {
      const pick = (m: Method): Ride[] => d.items.filter((i) => i.method === m).flatMap((i) => rideById(i.rideId) ?? []);
      return { d, multi: pick("multi"), extra: pick("multiExtra"), single: pick("single") };
    })
    .filter((r) => r.multi.length + r.extra.length + r.single.length > 0);
  // 取りにくい日から予約する（人気グループ・Sの多い日が先）
  const difficulty = (r: (typeof rows)[number]): number => r.multi.filter((x) => x.multiPassTier === 1).length * 2 + r.multi.length + r.single.length;
  const ordered = [...rows].sort((a, b) => difficulty(b) - difficulty(a));
  if (ordered.length === 0) return null;
  return (
    <div className="plan-day ll-sheet">
      <h3>⚡ 時短パスの段取り表</h3>
      <p className="note">
        予約開始: <strong>{lightningLaneOpensJst(TRIP.checkIn)}（日本時間）</strong>。滞在中の全日分を、下の順番（取りにくい日から）で予約します。Single Pass は当日に買います。
      </p>
      <ol>
        {ordered.map(({ d, multi, extra, single }) => (
          <li key={d.date}>
            <strong>
              {dayLabel(d.date)} {parkName(d.morningPark)}
            </strong>
            {multi.length > 0 && (
              <p>
                Multi Pass 事前予約: {multi.map((r) => `${r.multiPassTier === 1 && r.park !== "AK" ? "★" : ""}${r.nameJa}`).join("、")}
              </p>
            )}
            {extra.length > 0 && <p className="note">1本使った後の追加予約: {extra.map((r) => r.nameJa).join("、")}</p>}
            {single.length > 0 && <p>Single Pass（当日・有料）: {single.map((r) => r.nameJa).join("、")}</p>}
          </li>
        ))}
      </ol>
      <p className="note">★＝人気グループ（事前予約は1日1本まで）</p>
    </div>
  );
}
