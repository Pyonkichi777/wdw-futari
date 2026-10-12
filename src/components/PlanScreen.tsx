import { useState, type ReactNode } from "react";
import { LL_LONG, LL_SHORT, LL_VERIFIED_AT, llKind, type LlKind } from "../lib/lightningLane";
import { RIDES } from "../data/rides";
import { DAY_LIMIT_MINUTES, TRANSPORT_LABEL, dayTimeline, hoursText } from "../lib/timing";
import { WhereNow, todayInOrlando } from "./WhereNow";
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
  removeItems,
  restoreItem,
  setDayParks,
  unplaced,
  type DayPlan,
  type Method,
  type Plan,
  type PlanItem,
  type Slot,
} from "../lib/plan";
import { checkPlan } from "../lib/planChecks";
import { routeDay } from "../lib/route";
import { reservationTasks } from "../lib/reservations";
import { voteLabel, type AllVotes } from "../lib/consensus";
import type { Checks } from "../lib/checks";
import { ParkMap } from "./ParkMap";
import { isLowPriority } from "../lib/priority";
import { NECESSITY_LABEL, necessityOf, type Necessity } from "../lib/necessity";
import type { Consensus, ParkId, PersonId, Rank, Ride } from "../types";
import { SLOT_LABEL as SLOT_NAMES } from "../lib/plan";

interface Props {
  me: PersonId;
  consensus: Consensus;
  plan: Plan;
  /** 最新の作戦に変更を当てて保存する（2人の同時操作でも相手の変更を消さない） */
  onUpdate: (change: (p: Plan) => Plan) => void;
  /** 自分の変更がまだ相手に届いていない（電波待ち） */
  pending: boolean;
  votes: AllVotes;
  checks: Checks;
  onCheck: (id: string, done: boolean) => void;
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
export function PlanScreen({ me, consensus, plan, onUpdate, pending, votes, checks, onCheck }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [here, setHere] = useState<ParkId | "HOTEL" | null>(null);
  const today = todayInOrlando();
  const save = (change: (p: Plan) => Plan): void => onUpdate((p) => ({ ...change(p), updatedBy: me, updatedAt: Date.now() }));
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

  // 本命パークも2人で共有（作戦と一緒に保存）
  const focus: ParkId | "" = plan.focusPark ?? (plan.days.length === 0 ? "AK" : "");
  const setFocus = (f: ParkId | ""): void =>
    save((p) => {
      const { focusPark: _old, ...rest } = p;
      return f ? { ...rest, focusPark: f } : rest;
    });
  const generate = (): void =>
    save((cur) => {
      // 外したものは作り直しても入れない（記録も引き継ぐ）
      const p = buildPlan(consensus.items, rideById, TRIP.parkDays, { ...(focus ? { focusPark: focus } : {}), ...(cur.excluded ? { excluded: cur.excluded } : {}) });
      return { ...p, days: p.days.map(routeDay) };
    });
  const voteText = (r: Ride): string | null => {
    const t = votes.toshi[r.id];
    const w = votes.tsuma[r.id];
    if (!t && !w) return null;
    return `Toshi: ${t ? voteLabel(r, t) : "—"} ／ 妻: ${w ? voteLabel(r, w) : "—"}`;
  };

  if (plan.days.length === 0) {
    return (
      <section>
        <h2>5日間の作戦</h2>
        <div className="empty-state">
          <p>確定した合意リストから、おすすめの5日間の作戦を自動で組みます。そのあと2人で手直しできます。</p>
          <FocusPicker value={focus} onChange={setFocus} />
          <button className="primary wide" onClick={generate}>
            合意リストからおすすめの作戦を作る
          </button>
        </div>
      </section>
    );
  }

  const isLow = (id: string): boolean => isLowPriority(votes, id);
  const lowIds = (date?: string): Set<string> =>
    new Set(plan.days.filter((d) => !date || d.date === date).flatMap((d) => d.items.map((i) => i.rideId)).filter(isLow));
  const removeLow = (date?: string): void => {
    const ids = lowIds(date);
    if (ids.size === 0) return;
    if (window.confirm(`2人とも「どちらでも」の${ids.size}件を${date ? "この日の" : "すべての日の"}作戦から外します。外したものは下の「🗑 外したもの」に記録され、2人で共有されます。いつでも元に戻せます。よろしいですか？`)) {
      save((p) => removeItems(p, ids, date, me));
    }
  };
  const warnings = checkPlan(plan, consensus.items, rideById);
  const reds = warnings.filter((w) => w.level === "red");
  const left = unplaced(plan, consensus.items);

  return (
    <section className="plan">
      <h2>5日間の作戦</h2>
      <p className={pending ? "sync pending" : "sync ok"}>{pending ? "⏳ 送信待ち（電波が戻ると自動で相手に届きます）" : "☁ 2人で同期済み（どちらのスマホで変えても、もう一方にすぐ反映）"}</p>
      {plan.updatedBy && plan.updatedAt && (
        <p className="note">
          最終更新: {plan.updatedBy === "toshi" ? "Toshi" : "妻"}（{new Date(plan.updatedAt).toLocaleString("ja-JP")}）
        </p>
      )}

      <WhereNow plan={plan} onHere={setHere} />

      <ReservationPanel plan={plan} checks={checks} onCheck={onCheck} votes={votes} />

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

      {lowIds().size > 0 && (
        <div className="low-bar">
          <span>
            💤 2人とも「どちらでも」が <strong>{lowIds().size}件</strong> 入っています（優先度低）
          </span>
          <button className="mini" onClick={() => removeLow()}>
            全部の日からまとめて外す
          </button>
        </div>
      )}

      {plan.days.map((d) => (
        <DayCard
          key={d.date}
          day={d}
          rankOf={rankOf}
          voteText={voteText}
          isLow={isLow}
          lowCount={lowIds(d.date).size}
          onRemoveLow={() => removeLow(d.date)}
          checks={checks}
          onRoute={() => save((p) => ({ ...p, days: p.days.map((x) => (x.date === d.date ? routeDay(x) : x)) }))}
          editing={editing}
          here={d.date === today ? here : null}
          onEdit={setEditing}
          onParks={(parks) => save((p) => setDayParks(p, d.date, parks))}
          onMove={(id, to) => {
            save((p) => moveItem(p, id, to));
            setEditing(null);
          }}
          onRemove={(id) => {
            save((p) => removeItem(p, id, me));
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
                        save((p) => moveItem(p, r.id, to));
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

      <ExcludedList plan={plan} rankOf={rankOf} onRestore={(ids) => save((p) => ids.reduce((acc, id) => restoreItem(acc, id, (x) => rideById(x)?.park), p))} />

      <LightningLaneSheet plan={plan} />
      <LightningLaneGuide />

      <div className="plan-day">
        <FocusPicker value={focus} onChange={setFocus} />
        <button
          className="link"
          onClick={() => {
            if (window.confirm("今の作戦を消して、合意リストからおすすめの作戦を作り直します。手で直したところは元に戻ります（予約のチェックは残ります）。よろしいですか？")) generate();
          }}
        >
          この本命パークで、おすすめの作戦に作り直す
        </button>
      </div>
    </section>
  );
}

function DayCard({
  day,
  days,
  rankOf,
  voteText,
  isLow,
  lowCount,
  onRemoveLow,
  checks,
  onRoute,
  editing,
  here,
  onEdit,
  onParks,
  onMove,
  onRemove,
}: {
  day: DayPlan;
  days: readonly DayPlan[];
  rankOf: (id: string) => Rank | undefined;
  voteText: (r: Ride) => string | null;
  isLow: (id: string) => boolean;
  lowCount: number;
  onRemoveLow: () => void;
  checks: Checks;
  onRoute: () => void;
  editing: string | null;
  here: ParkId | "HOTEL" | null;
  onEdit: (id: string | null) => void;
  onParks: (p: { morningPark: ParkId; eveningPark: ParkId }) => void;
  onMove: (id: string, to: { date: string; slot: Slot; method: Method }) => void;
  onRemove: (id: string) => void;
}) {
  const isReserve = day.date === TRIP.parkDays[TRIP.parkDays.length - 1];
  return (
    <div className={`plan-day park-${day.morningPark}${here !== null ? " today" : ""}`}>
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
      <DayTimeline
        day={day}
        here={here}
        render={(it, r, minutes) => (
          <>
            <ItemRow
              ride={r}
              rank={rankOf(r.id)}
              item={it}
              minutes={minutes}
              votes={voteText(r)}
              low={isLow(r.id)}
              onQuickRemove={() => onRemove(r.id)}
              reserved={it.method === "meal" && r.dining && r.dining.booking !== "none" ? checks[`dine:${day.date}:${r.id}`] !== undefined : undefined}
              onClick={() => onEdit(editing === r.id ? null : r.id)}
            />
            {editing === r.id && <ItemEditor ride={r} days={days} current={{ date: day.date, slot: it.slot, method: it.method }} onMove={(to) => onMove(r.id, to)} onRemove={() => onRemove(r.id)} />}
          </>
        )}
      />
      {lowCount > 0 && (
        <button className="mini low-day" onClick={onRemoveLow}>
          💤 この日の「2人ともどちらでも」{lowCount}件をまとめて外す
        </button>
      )}
      <DayMap day={day} rankOf={rankOf} onRoute={onRoute} />
      {day.items.length === 0 && <p className="empty">{isReserve ? "予備日です。取りこぼした乗り物の回収や、もう一度乗りたいものに使います。" : "まだ何も入っていません。"}</p>}
    </div>
  );
}

/** 1日の流れ: 📍パーク → 項目（所要時間つき）→ 🚌移動 → … */
function DayTimeline({ day, here, render }: { day: DayPlan; here: ParkId | "HOTEL" | null; render: (it: PlanItem, r: Ride, minutes: number) => ReactNode }) {
  const { segments, totalMinutes } = dayTimeline(day, rideById);
  let lastSlot: Slot | null = null;
  return (
    <>
      <p className={totalMinutes > DAY_LIMIT_MINUTES ? "plan-total over" : "plan-total"}>
        ⏱ 合計 {hoursText(totalMinutes)}（移動込みの目安）{totalMinutes > DAY_LIMIT_MINUTES && " ・詰め込みすぎかも"}
      </p>
      <ul className="plan-items timeline">
        {segments.map((seg, i) => {
          if (seg.type === "travel") {
            const toName = seg.to === "HOTEL" ? "ホテル（ポップセンチュリー）" : parkName(seg.to);
            return (
              <li key={`t${i}`} className="plan-travel-wrap">
                <p className="plan-travel">
                  {seg.leg.by === "skyliner" ? "🚡" : seg.leg.by === "monorail" ? "🚝" : seg.leg.by === "bus" ? "🚌" : "🚶"} {toName}へ移動 {hoursText(seg.leg.minutes)}（{TRANSPORT_LABEL[seg.leg.by]}）
                </p>
                {seg.to !== "HOTEL" && (
                  <p className={`plan-at park-${seg.to}`}>
                    📍 {parkName(seg.to)}
                    {here === seg.to && <span className="here">今ここ</span>}
                  </p>
                )}
              </li>
            );
          }
          const showSlot = seg.item.slot !== lastSlot;
          lastSlot = seg.item.slot;
          return (
            <li key={seg.item.rideId}>
              {showSlot && <p className="plan-slot-label">{SLOT_LABEL[seg.item.slot]}</p>}
              {render(seg.item, seg.ride, seg.minutes)}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ItemRow({
  ride,
  rank,
  item,
  minutes,
  votes,
  reserved,
  low = false,
  onQuickRemove,
  onClick,
}: {
  ride: Ride;
  rank: Rank | undefined;
  item: PlanItem | null;
  minutes?: number;
  votes?: string | null;
  reserved?: boolean;
  low?: boolean;
  onQuickRemove?: () => void;
  onClick: () => void;
}) {
  const row = (
    <button className={low ? "plan-item low" : "plan-item"} onClick={onClick}>
      {low && <span className="low-tag">💤 優先度低</span>}
      {rank && <span className={`plan-rank rank-${rank}`}>{rank}</span>}
      {item?.suggested && <span className="plan-rank sug">おすすめ</span>}
      <span className="plan-item-name">{ride.nameJa}</span>
      {item && <span className={`plan-method m-${item.method}`}>{METHOD_LABEL[item.method]}</span>}
      {ride.kind === "ride" && <span className={`ll ll-${llKind(ride)}`}>{LL_SHORT[llKind(ride)]}</span>}
      {minutes !== undefined && <span className="plan-min">⏱ {hoursText(minutes)}</span>}
      {reserved !== undefined && <span className={reserved ? "rsv done" : "rsv todo"}>{reserved ? "✓ 予約済み" : "要予約・未"}</span>}
      {votes && <span className="plan-votes">{votes}</span>}
    </button>
  );
  if (!low || !onQuickRemove) return row;
  return (
    <div className="plan-item-wrap">
      {row}
      <button className="quick-remove" onClick={onQuickRemove} aria-label={`${ride.nameJa}を作戦から外す`}>
        外す
      </button>
    </div>
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
        予約開始: <strong>{lightningLaneOpensJst(TRIP.checkIn)}（日本時間）</strong>。Multi Pass・Single Pass とも、ホテル宿泊者は滞在中の全日分をこの日時から買えます。下の順番（取りにくい日から）で予約します。
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
            {single.length > 0 && <p>Single Pass（有料・売り切れ注意）: {single.map((r) => r.nameJa).join("、")}</p>}
          </li>
        ))}
      </ol>
      <p className="note">★＝人気グループ（事前予約は1日1本まで）</p>
    </div>
  );
}

/** パークごとの時短パスの対象一覧（公式サイトで確認した内容） */
function LightningLaneGuide() {
  const kinds: LlKind[] = ["singleOnly", "multiTier1", "multi"];
  return (
    <details className="plan-day ll-guide">
      <summary>
        <strong>📋 時短パスで乗れる乗り物の一覧</strong>
        <span className="note">（公式サイトで{LL_VERIFIED_AT}に確認）</span>
      </summary>
      <p className="note">
        Multi Pass（1日ごとに買う。事前予約3本＋使ったら追加予約）と Single Pass（1本ずつ買う）は<strong>別物</strong>です。Single Pass専用の乗り物は、Multi Passを持っていても時短の列には入れません。
      </p>
      {PARKS.map((p) => (
        <div key={p.id} className="ll-park">
          <h4>{p.nameJa}</h4>
          {kinds.map((k) => {
            const list = RIDES.filter((r) => r.park === p.id && r.kind === "ride" && llKind(r) === k);
            if (list.length === 0) return null;
            return (
              <p key={k}>
                <span className={`ll ll-${k}`}>{LL_SHORT[k]}</span> {list.map((r) => r.nameJa).join("、")}
              </p>
            );
          })}
        </div>
      ))}
      <p className="note">ここに載っていない乗り物は、{LL_LONG.none}。対象は出発前（3月末）にもう一度確認します。</p>
    </details>
  );
}

/** その日に回るパークごとの地図と動線（押すと開く） */
function DayMap({ day, rankOf, onRoute }: { day: DayPlan; rankOf: (id: string) => Rank | undefined; onRoute: () => void }) {
  const [open, setOpen] = useState(false);
  const parks = [...new Set([day.morningPark, day.eveningPark])];
  if (day.items.length === 0) return null;
  return (
    <>
      <button className="map-toggle" onClick={() => setOpen(!open)}>
        🗺 {open ? "地図と動線をとじる" : "地図と動線を見る"}
      </button>
      {open && (
        <>
          {parks.map((park) => (
            <div key={park}>
              <p className={`plan-at park-${park}`}>📍 {parkName(park)}</p>
              <ParkMap park={park} items={day.items.filter((i) => rideById(i.rideId)?.park === park)} rankOf={rankOf} />
            </div>
          ))}
          <button className="mini" onClick={onRoute}>
            🔁 この日の午前・午後の乗り物を「近い順」に組み直す
          </button>
        </>
      )}
    </>
  );
}

/** 事前の予約・購入が必要なもの（作戦から自動で作る）。済んだらチェック（2人で共有） */
type NeedFilter = "ALL" | Necessity | "optional";

const NEED_FILTERS: readonly { id: NeedFilter; label: string }[] = [
  { id: "ALL", label: "すべて" },
  { id: "both", label: "2人とも絶対" },
  { id: "one", label: "どちらかが絶対" },
  { id: "none", label: "絶対なし" },
  { id: "optional", label: "任意（保険）" },
];

function ReservationPanel({ plan, checks, onCheck, votes }: { plan: Plan; checks: Checks; onCheck: (id: string, done: boolean) => void; votes: AllVotes }) {
  const [need, setNeed] = useState<NeedFilter>("ALL");
  const all = reservationTasks(plan, rideById).map((t) => ({ ...t, need: necessityOf(t.rideIds, votes) }));
  if (all.length === 0) return null;
  const tasks = all.filter((t) => (need === "ALL" ? true : need === "optional" ? t.kind === "singleOptional" : t.kind !== "singleOptional" && t.need === need));
  const left = all.filter((t) => checks[t.id] === undefined && t.kind !== "singleOptional").length;
  return (
    <details className="plan-day rsv-panel" open={left > 0}>
      <summary>
        <strong>📅 事前の予約・購入が必要なもの</strong>
        <span className={left > 0 ? "rsv todo" : "rsv done"}>{left > 0 ? `残り${left}件` : "すべて済み"}</span>
      </summary>
      <div className="chips wrap" role="group" aria-label="必須度で絞り込む">
        {NEED_FILTERS.map((f) => (
          <button key={f.id} aria-pressed={need === f.id} className={need === f.id ? "chip on" : "chip"} onClick={() => setNeed(f.id)}>
            {f.label}
            <span className="vs-num">{f.id === "ALL" ? all.length : f.id === "optional" ? all.filter((t) => t.kind === "singleOptional").length : all.filter((t) => t.kind !== "singleOptional" && t.need === f.id).length}</span>
          </button>
        ))}
      </div>
      <ul className="rsv-list">
        {tasks.length === 0 && <li className="empty">この条件に当てはまるものはありません。</li>}
        {tasks.map((t) => {
          const done = checks[t.id];
          return (
            <li key={t.id} className={done ? "is-done" : undefined}>
              <label>
                <input type="checkbox" checked={done !== undefined} onChange={(e) => onCheck(t.id, e.target.checked)} />
                <span>
                  <strong>{t.title}</strong>
                  {t.kind !== "singleOptional" && <small className={`need need-${t.need}`}>{NECESSITY_LABEL[t.need]}</small>}
                  <small>{t.detail}</small>
                  <small>予約開始: {t.opens}</small>
                  {done && (
                    <small className="rsv-by">
                      ✓ {done.by === "toshi" ? "Toshi" : "妻"}が対応済み（{new Date(done.at).toLocaleDateString("ja-JP")}）
                    </small>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="note">作戦を変えると、この一覧も自動で変わります（チェックは残ります）。</p>
    </details>
  );
}

/** 本命パーク（いちばん空いている日に置き、予備日も優先する） */
function FocusPicker({ value, onChange }: { value: ParkId | ""; onChange: (p: ParkId | "") => void }) {
  return (
    <label className="focus-picker">
      ⭐ 本命パーク（いちばん空いている日に置く）
      <select value={value} onChange={(e) => onChange(e.target.value as ParkId | "")}>
        <option value="">決めない</option>
        {PARKS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nameJa}
          </option>
        ))}
      </select>
      <small className="note">混み具合は曜日の一般的な傾向（土＞日＞月＞火・水）で判断しています。</small>
    </label>
  );
}

/** 作戦から外したもの（2人で共有）。元の日・時間に戻せる */
function ExcludedList({ plan, rankOf, onRestore }: { plan: Plan; rankOf: (id: string) => Rank | undefined; onRestore: (ids: string[]) => void }) {
  const list = plan.excluded ?? [];
  if (list.length === 0) return null;
  return (
    <details className="plan-day excluded-list">
      <summary>
        <strong>🗑 外したもの（{list.length}件）</strong>
        <span className="note">作り直しても入りません。押すと元に戻せます</span>
      </summary>
      <ul className="plan-items">
        {list.map((e) => {
          const r = rideById(e.rideId);
          if (!r) return null;
          const rank = rankOf(e.rideId);
          return (
            <li key={e.rideId} className="excluded-row">
              <div>
                {rank && <span className={`plan-rank rank-${rank}`}>{rank}</span>} <strong>{r.nameJa}</strong>
                <small>
                  元: {dayLabel(e.date)} {SLOT_NAMES[e.slot]}
                  {e.by && `・${e.by === "toshi" ? "Toshi" : "妻"}が外した`}
                  {e.at > 0 && `（${new Date(e.at).toLocaleDateString("ja-JP")}）`}
                </small>
              </div>
              <button className="mini" onClick={() => onRestore([e.rideId])}>
                ↩ 戻す
              </button>
            </li>
          );
        })}
      </ul>
      <button
        className="link"
        onClick={() => {
          if (window.confirm(`外した${list.length}件を、すべて元の日・時間に戻します。よろしいですか？`)) onRestore(list.map((e) => e.rideId));
        }}
      >
        すべて元に戻す
      </button>
    </details>
  );
}
