import { useMemo, useState, type ReactNode } from "react";
import { LL_LONG, LL_SHORT, LL_VERIFIED_AT, llKind, type LlKind } from "../lib/lightningLane";
import { RIDES } from "../data/rides";
import { DAY_LIMIT_MINUTES, TRANSPORT_LABEL, dayTimeline, hoursText, travel } from "../lib/timing";
import { WhereNow, todayInOrlando } from "./WhereNow";
import { PARKS, parkName } from "../data/parks";
import { rideById } from "../data/rides";
import { ITINERARY, TRIP } from "../data/trip";
import { lightningLaneOpensJst } from "../lib/dining";
import {
  unpinItem,
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
  parkOrderFor,
  withKept,
  type DayPlan,
  type FixedParks,
  type Method,
  type Plan,
  type PlanItem,
  type Slot,
} from "../lib/plan";
import { checkPlan, fixAllReds, type PlanWarning } from "../lib/planChecks";
import { clock, dayTimes, type FixedTimes } from "../lib/bookTimes";
import type { HoursFeed } from "../lib/hours";
import { newSnapshotId, type PlanSnapshot } from "../lib/snapshots";
import { SnapshotPanel } from "./SnapshotPanel";
import { PlanTextPanel } from "./PlanTextPanel";
import { CROWD_ICON, CROWD_LABEL, CROWD_SOURCE, crowdInfo, type CrowdFeed } from "../lib/crowd";
import { applyFix, excludeAllLow, skipUnplaced } from "../lib/planFixes";
import { optimizePlan, routeDay } from "../lib/route";
import { bookingSteps, daysUntil, isHardToBook, llDayDifficulty } from "../lib/reservations";
import { voteLabel, type AllVotes } from "../lib/consensus";
import { fixedTimesFor, type Checks } from "../lib/checks";
import { ParkMap } from "./ParkMap";
import { isLowPriority, isVetoed } from "../lib/priority";
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
  /** 取れた予約の時刻を入れる（"HH:MM"、null で消す） */
  onGotTime: (id: string, rideId: string, hm: string | null) => void;
  /** 図鑑でそのアトラクション・店を見る（anchor = 戻ってきたときに表示する場所） */
  onZukan: (rideId: string, anchor: string) => void;
  /** 混雑予想サイトから取り込んだ値（まだ無ければ null） */
  crowd: CrowdFeed | null;
  /** 公式の営業時間（まだ公開されていなければ null） */
  hours: HoursFeed | null;
  /** 作戦の保存（2人それぞれ。合計10件まで） */
  snapshots: readonly PlanSnapshot[];
  onSaveSnapshot: (snap: PlanSnapshot, replaceOldestOwn: boolean) => Promise<void>;
  onDeleteSnapshot: (id: string) => Promise<void>;
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
export function PlanScreen({ me, consensus, plan: stored, onUpdate, pending, votes, checks, onCheck, onGotTime, onZukan, crowd, hours, snapshots, onSaveSnapshot, onDeleteSnapshot }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [here, setHere] = useState<ParkId | "HOTEL" | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const today = todayInOrlando();
  // どちらか1人でも「乗らない」と答えたものは、作戦に入れない（前に作った作戦からも外して表示・保存する）
  const vetoed = (id: string): boolean => isVetoed(votes, id);
  const items = useMemo(() => consensus.items.filter((c) => !isVetoed(votes, c.rideId)), [consensus, votes]);
  const dropVetoed = (p: Plan): Plan => ({ ...p, days: p.days.map((d) => ({ ...d, items: d.items.filter((i) => !vetoed(i.rideId)) })) });
  // 道順はいつも「近い順」（作った直後も、手で直した後も、前に保存した作戦も）
  const plan = useMemo(() => optimizePlan(dropVetoed(stored)), [stored, votes]);
  const save = (change: (p: Plan) => Plan): void => onUpdate((p) => ({ ...optimizePlan(dropVetoed(change(p))), updatedBy: me, updatedAt: Date.now() }));
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
  const focusParks: ParkId[] = plan.focusParks ?? (plan.days.length === 0 ? ["AK"] : []);
  /** 優先順位・混雑予想・合意リストから作戦を組み直す（外したもの・「どちらでも」の設定・予約のチェックは引き継ぐ） */
  const rebuild = (cur: Plan, fp: readonly ParkId[]): Plan => {
    // 外したものは作り直しても入れない（記録も引き継ぐ）。「どちらでも」をまとめて外した後なら、それも入れない
    const base = cur.dropLow ? excludeAllLow(cur, items, (id) => isLowPriority(votes, id), rideById, me) : cur;
    const p = buildPlan(items, rideById, TRIP.parkDays, {
      focusParks: fp,
      crowd,
      ...(base.excluded ? { excluded: base.excluded } : {}),
      ...(base.fixedParks ? { fixedParks: base.fixedParks } : {}),
    });
    return {
      ...p,
      days: p.days.map(routeDay),
      ...(base.dropLow ? { dropLow: true as const } : {}),
      ...(base.keptLow ? { keptLow: base.keptLow } : {}),
    };
  };
  // 優先順位を変えたら、その場で作戦全体（日割り・乗り方・時刻・事前予約）を組み直す
  const setFocusParks = (fp: ParkId[]): void =>
    save((p) => {
      if (p.days.length > 0) return rebuild(p, fp);
      const { focusParks: _old, ...rest } = p;
      return fp.length > 0 ? { ...rest, focusParks: fp } : rest;
    });
  const generate = (): void => save((cur) => rebuild(cur, focusParks));
  /** 「この日はこのパーク」を2人で決める（もう一度押すと自動に戻す）。決めたら作戦全体を組み直す */
  const pickPark = (date: string, park: ParkId): void =>
    save((cur) => {
      const fixed = { ...(cur.fixedParks ?? {}) };
      if (fixed[date] === park) delete fixed[date];
      else fixed[date] = park;
      const { fixedParks: _old, ...rest } = cur;
      const next: Plan = Object.keys(fixed).length > 0 ? { ...rest, fixedParks: fixed } : rest;
      return next.days.length > 0 ? rebuild(next, focusParks) : next;
    });
  const clearFixed = (): void =>
    save((cur) => {
      const { fixedParks: _old, ...rest } = cur;
      return rest.days.length > 0 ? rebuild(rest, focusParks) : rest;
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
          <FocusPicker value={focusParks} onChange={setFocusParks} plan={null} crowd={crowd} fixed={plan.fixedParks ?? {}} onPick={pickPark} onClearFixed={clearFixed} />
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
    if (ids.size === 0 && (date || plan.dropLow)) return;
    if (date) {
      if (window.confirm(`2人とも「どちらでも」の${ids.size}件をこの日の作戦から外します。外したものは下の「🗑 外したもの」に記録され、2人で共有されます。作り直しても戻りません（自分で戻すことはできます）。よろしいですか？`)) {
        save((p) => removeItems(p, ids, date, me));
      }
      return;
    }
    if (window.confirm(`2人とも「どちらでも」を、すべての日の作戦から外します（今入っている${ids.size}件と、どの日にも入っていないものも）。今後は作り直しても、優先順位を変えても入りません。外したものは「🗑 外したもの」に記録され、1つずつ元に戻せます。よろしいですか？`)) {
      save((p) => excludeAllLow(p, items, isLow, rideById, me));
    }
  };
  // 取れた予約の時刻に、前の予定から間に合わない（🔴）
  const lateWarnings: PlanWarning[] = plan.days.flatMap((d): PlanWarning[] => {
    const h = dayTimes(d, rideById, hours, fixedTimesFor(checks, d.date)).hints;
    return d.items.flatMap((i) => {
      const x = h.get(i.rideId);
      return x?.late ? [{ level: "red" as const, date: d.date, message: `${dayLabel(d.date)}: 取れた予約「${rideById(i.rideId)?.nameJa ?? i.rideId}」（${clock(x.at)}）に、前の予定から間に合いません。前の予定を外すか動かしてください` }] : [];
    });
  });
  const warnings = [...lateWarnings, ...checkPlan(plan, items, rideById)];
  // 優先順位・混雑予想が変わって、今の日割りがおすすめと違うとき
  const best = parkOrderFor(items, rideById, TRIP.parkDays, {
    focusParks,
    crowd,
    ...(plan.excluded ? { excluded: plan.excluded } : {}),
    ...(plan.fixedParks ? { fixedParks: plan.fixedParks } : {}),
  });
  const stale = plan.days.slice(0, best.length).some((d, i) => d.morningPark !== best[i]) ? best : null;
  const reds = warnings.filter((w) => w.level === "red");
  const fixableReds = reds.filter((w) => w.fix).length;
  const kept = new Set(plan.keptLow ?? []);
  // 「どちらでも」をまとめて外した後は、新しく「どちらでも」になったものも作戦に出さない（次の作り直しで記録される）
  const left = unplaced(plan, items).filter((c) => !(plan.dropLow && isLow(c.rideId) && !kept.has(c.rideId)));
  const leftSA = left.filter((c) => c.rank === "S" || c.rank === "A");

  return (
    <section className="plan">
      <h2>5日間の作戦</h2>
      <p className={pending ? "sync pending" : "sync ok"}>{pending ? "⏳ 送信待ち（電波が戻ると自動で相手に届きます）" : "☁ 2人で同期済み（どちらのスマホで変えても、もう一方にすぐ反映）"}</p>
      {plan.updatedBy && plan.updatedAt && (
        <p className="note">
          最終更新: {plan.updatedBy === "toshi" ? "Toshi" : "妻"}（{new Date(plan.updatedAt).toLocaleString("ja-JP")}）
        </p>
      )}

      <DayJump days={plan.days} today={today} reds={reds.length} left={left.length} onLeft={() => setLeftOpen(true)} />

      <WhereNow plan={plan} onHere={setHere} />

      <ReservationPanel plan={plan} checks={checks} onCheck={onCheck} onGotTime={onGotTime} votes={votes} onZukan={onZukan} hours={hours} />

      {leftSA.length > 0 && (
        <div className="left-sa">
          <p>
            📦 まだどの日にも入っていない: {(["S", "A"] as const).map((rk) => {
              const n = leftSA.filter((c) => c.rank === rk);
              return n.length > 0 ? `${rk} ${n.length}件（${n.map((c) => rideById(c.rideId)?.nameJa ?? c.rideId).join("、")}）` : null;
            }).filter(Boolean).join(" ／ ")}
          </p>
          <small>日に入れるか、「見送る」かを2人で決めてください（勝手には入れません）</small>
          <button
            className="mini"
            onClick={() => {
              setLeftOpen(true);
              requestAnimationFrame(() => document.getElementById("plan-left")?.scrollIntoView({ behavior: "smooth", block: "start" }));
            }}
          >
            一覧で決める
          </button>
        </div>
      )}

      <div id="plan-check" className={reds.length > 0 ? "plan-check bad" : "plan-check ok"}>
        <p className="plan-check-title">{reds.length > 0 ? `🔴 直すところが${reds.length}件あります` : "✅ 自動チェックで見つかった🔴はありません（時刻は目安。営業時間・上演時刻の確定はまだ）"}</p>
        <ul>
          {warnings.map((w, i) => (
            <li key={i} className={`w-${w.level}`}>
              {w.level === "red" ? "🔴" : "🟡"} {w.message}
              {w.fix && (
                <div className="fix">
                  <span>💡 おすすめ: {w.fix.text}</span>
                  <button className="mini" onClick={() => w.fix && save((p) => applyFix(p, w.fix!))}>
                    この提案で直す
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {fixableReds > 1 && (
          <button className="mini fix-all" onClick={() => save((p) => fixAllReds(p, items, rideById))}>
            💡 おすすめどおりに🔴をまとめて直す（{fixableReds}件）
          </button>
        )}
      </div>

      <details className="plan-day focus-panel" id="plan-focus">
        <summary>
          <strong>⭐ 本命パークの優先順位と混雑予想</strong>
          <span className="note">{focusParks.length > 0 ? focusParks.map((p, i) => `${i + 1}.${PARK_SHORT[p]}`).join(" ") : "未設定"}</span>
        </summary>
        <FocusPicker value={focusParks} onChange={setFocusParks} plan={plan} crowd={crowd} fixed={plan.fixedParks ?? {}} onPick={pickPark} onClearFixed={clearFixed} />
        <p className="note">優先順位を変えると、その場で作戦全体（日割り・乗り方・時刻・事前の予約）を組み直し、2人で共有します。手で直したところは元に戻ります（外したもの・予約のチェックは残ります）。</p>
      </details>

      <SnapshotPanel
        me={me}
        list={snapshots}
        plan={plan}
        onSave={(name, replace) => onSaveSnapshot({ id: newSnapshotId(), by: me, savedAt: Date.now(), name, plan: { ...plan, updatedBy: me, updatedAt: Date.now() } }, replace)}
        onDelete={onDeleteSnapshot}
        onRestore={(snap) => save(() => snap.plan)}
      />

      <PlanTextPanel plan={plan} checks={checks} hours={hours} />

      {stale && (
        <div className="stale-bar">
          <p>
            🔄 今の優先順位と最新の混雑予想なら、日割りは <strong>{stale.map((p, i) => `${shortDay(TRIP.parkDays[i] ?? "")} ${PARK_SHORT[p]}`).join("・")}</strong> がおすすめです（今の作戦と違います）
          </p>
          <button
            className="primary"
            onClick={() => {
              if (window.confirm("最新の混雑予想と優先順位で、作戦全体を組み直します。手で直したところは元に戻ります（外したもの・予約のチェックは残ります）。よろしいですか？")) generate();
            }}
          >
            組み直す
          </button>
          <small>パークの日を手で変えた場合は、このままで構いません</small>
        </div>
      )}

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
      {plan.dropLow && (
        <div className="low-bar off">
          <span>💤 「2人ともどちらでも」は外したままにする設定です（作り直しても、優先順位を変えても入りません）。戻したいものは「🗑 外したもの」から1つずつ戻せます</span>
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
          onUnpin={(id) => save((p) => unpinItem(p, id))}
          editing={editing}
          here={d.date === today ? here : null}
          onEdit={setEditing}
          onParks={(parks) =>
            // 朝のパークを変えたら「この日はこのパーク」として作戦全体を組み直す。夕方からのパーク（ホッパー）だけならその日だけ変える
            parks.morningPark !== d.morningPark ? pickPark(d.date, parks.morningPark) : save((p) => setDayParks(p, d.date, parks))
          }
          onMove={(id, to) => {
            // 午前／午後を手で変えたものは固定（自動の「近い順」で入れ替えない）
            const cur = d.items.find((i) => i.rideId === id);
            save((p) => moveItem(p, id, to, { pin: cur !== undefined && cur.slot !== to.slot }));
            setEditing(null);
          }}
          onRemove={(id) => {
            save((p) => removeItem(p, id, me));
            setEditing(null);
          }}
          onZukan={onZukan}
          crowd={crowd}
          hours={hours}
          days={plan.days}
        />
      ))}

      {left.length > 0 && (
        <details className="plan-day left-list" id="plan-left" open={leftOpen} onToggle={(e) => setLeftOpen(e.currentTarget.open)}>
          <summary>
            <strong>📦 どの日にも入っていないもの（{left.length}件）</strong>
            <span className="note">{leftOpen ? "押すと閉じます" : "押すと開きます。押して日に入れられます"}</span>
          </summary>
          <ul className="plan-items">
            {left.map((c) => {
              const r = rideById(c.rideId);
              if (!r) return null;
              return (
                <li key={c.rideId} id={`pi-left-${c.rideId}`}>
                  <ItemRow ride={r} rank={c.rank} item={null} onZukan={() => onZukan(r.id, `pi-left-${r.id}`)} onClick={() => setEditing(editing === r.id ? null : r.id)} />
                  <button
                    className="mini skip-left"
                    onClick={() => {
                      if (window.confirm(`「${r.nameJa}」を今回は見送ります。「🗑 外したもの」に記録され、作り直しても入りません。いつでも戻せます。よろしいですか？`)) save((p) => skipUnplaced(p, c, rideById, me));
                    }}
                  >
                    今回は見送る
                  </button>
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
        </details>
      )}

      <ExcludedList plan={plan} rankOf={rankOf} onRestore={(ids) =>
          save((p) => {
            const restored = ids.reduce((acc, id) => restoreItem(acc, id, (x) => rideById(x)?.park), p);
            // 自分で戻した「どちらでも」は、作り直しても外さない
            const back = ids.filter(isLow);
            return back.length > 0 ? withKept(restored, [...new Set([...(restored.keptLow ?? []), ...back])]) : restored;
          })
        } />

      <LightningLaneSheet plan={plan} />
      <LightningLaneGuide />

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
  onUnpin,
  editing,
  here,
  onEdit,
  onParks,
  onMove,
  onRemove,
  onZukan,
  crowd,
  hours,
}: {
  day: DayPlan;
  days: readonly DayPlan[];
  rankOf: (id: string) => Rank | undefined;
  voteText: (r: Ride) => string | null;
  isLow: (id: string) => boolean;
  lowCount: number;
  onRemoveLow: () => void;
  checks: Checks;
  onUnpin: (id: string) => void;
  editing: string | null;
  here: ParkId | "HOTEL" | null;
  onEdit: (id: string | null) => void;
  onParks: (p: { morningPark: ParkId; eveningPark: ParkId }) => void;
  onMove: (id: string, to: { date: string; slot: Slot; method: Method }) => void;
  onRemove: (id: string) => void;
  onZukan: (rideId: string, anchor: string) => void;
  crowd: CrowdFeed | null;
  hours: HoursFeed | null;
}) {
  const isReserve = day.date === TRIP.parkDays[TRIP.parkDays.length - 1];
  return (
    <div id={`plan-day-${day.date}`} className={`plan-day park-${day.morningPark}${here !== null ? " today" : ""}`}>
      <div className="plan-day-head">
        <h3>
          {dayLabel(day.date)}
          {isReserve && <span className="plan-tag">予備日</span>}
          {needsMultiPass(day) && <span className="plan-tag mp">Multi Pass</span>}
        </h3>
        <CrowdBadge park={day.morningPark} date={day.date} crowd={crowd} />
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
        hours={hours}
        fixed={fixedTimesFor(checks, day.date)}
        here={here}
        render={(it, r, minutes, time) => (
          <>
            <ItemRow
              ride={r}
              rank={rankOf(r.id)}
              item={it}
              minutes={minutes}
              time={time}
              votes={voteText(r)}
              low={isLow(r.id)}
              onQuickRemove={() => onRemove(r.id)}
              onZukan={() => onZukan(r.id, `pi-${day.date}-${r.id}`)}
              reserved={it.method === "meal" && r.dining && r.dining.booking !== "none" ? checks[`dine:${day.date}:${r.id}`] !== undefined : undefined}
              onClick={() => onEdit(editing === r.id ? null : r.id)}
            />
            {editing === r.id && (
              <ItemEditor
                ride={r}
                days={days}
                current={{ date: day.date, slot: it.slot, method: it.method }}
                onMove={(to) => onMove(r.id, to)}
                onRemove={() => onRemove(r.id)}
                {...(it.pinned ? { onUnpin: () => onUnpin(r.id) } : {})}
              />
            )}
          </>
        )}
      />
      {lowCount > 0 && (
        <button className="mini low-day" onClick={onRemoveLow}>
          💤 この日の「2人ともどちらでも」{lowCount}件をまとめて外す
        </button>
      )}
      <DayMap day={day} rankOf={rankOf} />
      {day.items.length === 0 && <p className="empty">{isReserve ? "予備日です。取りこぼした乗り物の回収や、もう一度乗りたいものに使います。" : "まだ何も入っていません。"}</p>}
    </div>
  );
}

/** 1日の流れ: 📍パーク → 項目（所要時間つき）→ 🚌移動 → … */
function DayTimeline({
  day,
  hours,
  fixed,
  here,
  render,
}: {
  day: DayPlan;
  hours: HoursFeed | null;
  fixed: FixedTimes;
  here: ParkId | "HOTEL" | null;
  render: (it: PlanItem, r: Ride, minutes: number, time: string | undefined) => ReactNode;
}) {
  const { segments, totalMinutes } = dayTimeline(day, rideById);
  const times = dayTimes(day, rideById, hours, fixed);
  const official = hours?.days[day.date]?.[day.morningPark];
  const early = day.items.some((i) => i.method === "early");
  // 「夕方から」のパークに予定がない（移動は描かず、案内だけ出す）
  const eveningIdle = day.items.length > 0 && day.eveningPark !== day.morningPark && !day.items.some((i) => rideById(i.rideId)?.park === day.eveningPark);
  let lastSlot: Slot | null = null;
  return (
    <>
      {day.items.length > 0 && (
        <p className={totalMinutes > DAY_LIMIT_MINUTES ? "plan-total over" : "plan-total"}>
          ⏱ 予定の時間（乗り物・食事・ショー・移動の合計）{hoursText(totalMinutes)}
          {totalMinutes > DAY_LIMIT_MINUTES && " ・詰め込みすぎかも"}
          <br />
          🕗 パーク着〜ホテル着 {hoursText(Math.max(0, times.end - times.start))}
          {times.idle >= 30 && `（うち空き時間 ${hoursText(times.idle)}。食事やショーの時刻を待つ時間で、休憩にあててもよい）`}
        </p>
      )}
      <p className="plan-clock">
        {day.items.length > 0 ? times.lateStart
            ? `🕗 朝の予定なし。${clock(times.start)}頃の最初の予定に合わせて出かける → 予定が終わって 🏨 ${clock(times.end)}頃 ホテル着`
            : `🕗 ${clock(times.start)} パーク着（${early ? "開園前入園" : "開園"}）→ 予定が終わって 🏨 ${clock(times.end)}頃 ホテル着` : "🕗 まだ予定がありません"}
        <small>
          {official
            ? `公式の営業時間 ${official.early ? `開園前入園 ${official.early}・` : ""}開園 ${official.open}〜閉園 ${official.close}（${hours?.fetchedAt}取得）で計算。`
            : "公式の営業時間がまだ出ていないため、開園9:00（開園前入園8:30）と仮定。"}
          予約の「選ぶ時間枠」と同じ計算です
        </small>
      </p>
      {eveningIdle && (
        <p className="plan-evening-idle">
          🌙 夕方から{parkName(day.eveningPark)}の予定（ホッパー）ですが、まだ何も入っていません。行くなら移動 約{travel(day.morningPark, day.eveningPark)?.minutes ?? 30}分
        </p>
      )}
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
            <li key={seg.item.rideId} id={`pi-${day.date}-${seg.item.rideId}`}>
              {showSlot && <p className="plan-slot-label">{SLOT_LABEL[seg.item.slot]}</p>}
              {render(seg.item, seg.ride, seg.minutes, times.hints.get(seg.ride.id)?.text)}
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
  time,
  votes,
  reserved,
  low = false,
  onQuickRemove,
  onZukan,
  onClick,
}: {
  ride: Ride;
  rank: Rank | undefined;
  item: PlanItem | null;
  minutes?: number;
  time?: string | undefined;
  votes?: string | null;
  reserved?: boolean;
  low?: boolean;
  onQuickRemove?: () => void;
  onZukan?: () => void;
  onClick: () => void;
}) {
  const row = (
    <button className={low ? "plan-item low" : "plan-item"} onClick={onClick}>
      {time && <span className="plan-time">🕐 {time}</span>}
      {low && <span className="low-tag">💤 優先度低</span>}
      {rank && <span className={`plan-rank rank-${rank}`}>{rank}</span>}
      {item?.suggested && <span className="plan-rank sug">おすすめ</span>}
      {item?.pinned && <span className="plan-pin" title="午前／午後を手で決めたもの（自動の「近い順」でも入れ替えない）">📌</span>}
      <span className="plan-item-name">{ride.nameJa}</span>
      {item && <span className={`plan-method m-${item.method}`}>{METHOD_LABEL[item.method]}</span>}
      {ride.kind === "ride" && <span className={`ll ll-${llKind(ride)}`}>{LL_SHORT[llKind(ride)]}</span>}
      {minutes !== undefined && <span className="plan-min">⏱ {hoursText(minutes)}</span>}
      {reserved !== undefined && <span className={reserved ? "rsv done" : "rsv todo"}>{reserved ? "✓ 予約済み" : "要予約・未"}</span>}
      {votes && <span className="plan-votes">{votes}</span>}
    </button>
  );
  const remove = low && onQuickRemove;
  if (!remove && !onZukan) return row;
  return (
    <div className="plan-item-wrap">
      {row}
      <div className="plan-item-side">
        {onZukan && (
          <button className="zukan-link" onClick={onZukan} aria-label={`${ride.nameJa}を図鑑で見る`}>
            📖<small>図鑑</small>
          </button>
        )}
        {remove && (
          <button className="quick-remove" onClick={onQuickRemove} aria-label={`${ride.nameJa}を作戦から外す`}>
            外す
          </button>
        )}
      </div>
    </div>
  );
}

function ItemEditor({
  ride,
  days,
  current,
  onMove,
  onRemove,
  onUnpin,
}: {
  ride: Ride;
  days: readonly DayPlan[];
  current: { date: string; slot: Slot; method: Method } | null;
  onMove: (to: { date: string; slot: Slot; method: Method }) => void;
  onRemove?: () => void;
  /** 手で決めた午前／午後の固定を外す */
  onUnpin?: () => void;
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
        {onUnpin && (
          <button className="mini" onClick={onUnpin}>
            📌 固定を外して「近い順」に任せる
          </button>
        )}
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
  // 取りにくい日から予約する（予約の段取りと同じ基準。同点なら日付順）
  const ordered = [...rows].sort((a, b) => llDayDifficulty(b.d, rideById) - llDayDifficulty(a.d, rideById) || a.d.date.localeCompare(b.d.date));
  if (ordered.length === 0) return null;
  return (
    <div className="plan-day ll-sheet">
      <h3>⚡ 時短パスの段取り表</h3>
      <p className="note">
        予約開始: <strong>{lightningLaneOpensJst(TRIP.checkIn)}（日本時間）</strong>。Multi Pass・Single Pass とも、ホテル宿泊者は滞在中の全日分をこの日時から買えます。Single Pass（⚡）は日付に関係なく最初に買い、Multi Pass は下の順番（取りにくい日から）で予約します。上の「予約の段取り」と同じ順番です。
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
function DayMap({ day, rankOf }: { day: DayPlan; rankOf: (id: string) => Rank | undefined }) {
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
          <p className="note">🔁 午前・午後の乗り物は、いつも自動で「近い順」に並べています（手で午前／午後を決めた📌は動かしません）。</p>
        </>
      )}
    </>
  );
}

/** 事前の予約・購入が必要なもの（作戦から自動で作る）。済んだらチェック（2人で共有） */
type NeedFilter = "ALL" | Necessity | "optional";

const NEED_FILTERS: readonly { id: NeedFilter; label: string }[] = [
  { id: "ALL", label: "すべて" },
  { id: "both", label: "必須" },
  { id: "one", label: "ほぼ必須" },
  { id: "none", label: "できれば" },
  { id: "optional", label: "任意（保険）" },
];

function ReservationPanel({
  plan,
  checks,
  onCheck,
  votes,
  onZukan,
  hours,
  onGotTime,
}: {
  plan: Plan;
  checks: Checks;
  onCheck: (id: string, done: boolean) => void;
  onGotTime: (id: string, rideId: string, hm: string | null) => void;
  votes: AllVotes;
  onZukan: (rideId: string, anchor: string) => void;
  hours: HoursFeed | null;
}) {
  const [need, setNeed] = useState<NeedFilter>("ALL");
  const steps = bookingSteps(plan, rideById, hours).map((st) => ({ ...st, tasks: st.tasks.map((t) => ({ ...t, need: necessityOf(t.rideIds, votes) })) }));
  const all = steps.flatMap((st) => st.tasks).filter((t) => t.kind !== "prep");
  if (all.length === 0) return null;
  const match = (t: (typeof all)[number]): boolean =>
    need === "ALL" ? true : t.kind === "prep" ? false : need === "optional" ? t.kind === "singleOptional" : t.kind !== "singleOptional" && t.need === need;
  const countOf = (f: NeedFilter): number => (f === "ALL" ? all.length : f === "optional" ? all.filter((t) => t.kind === "singleOptional").length : all.filter((t) => t.kind !== "singleOptional" && t.need === f).length);
  const todo = steps.flatMap((st) => st.tasks).filter((t) => checks[t.id] === undefined && t.kind !== "singleOptional");
  const next = todo[0];
  let no = 0;
  return (
    <details className="plan-day rsv-panel" id="plan-rsv" open={todo.length > 0}>
      <summary>
        <strong>📅 事前の予約・購入（いつ・何を・どの順番で）</strong>
        <span className={todo.length > 0 ? "rsv todo" : "rsv done"}>{todo.length > 0 ? `残り${todo.length}件` : "すべて済み"}</span>
      </summary>
      {next && (
        <p className="rsv-next">
          👉 次にやること: <strong>{next.title}</strong>
        </p>
      )}
      <div className="chips wrap" role="group" aria-label="必須度で絞り込む">
        {NEED_FILTERS.map((f) => (
          <button key={f.id} aria-pressed={need === f.id} className={need === f.id ? "chip on" : "chip"} onClick={() => setNeed(f.id)}>
            {f.label}
            <span className="vs-num">{countOf(f.id)}</span>
          </button>
        ))}
      </div>
      <p className="note need-legend">必須＝2人とも「絶対」／ほぼ必須＝1人が「絶対」／できれば＝「絶対」と答えた人はいない（乗りたい・どちらでも）／任意＝朝イチで乗る予定の保険</p>
      {steps.map((st, i) => {
        const shown = st.tasks.filter(match);
        if (need !== "ALL" && shown.length === 0) return null;
        const doneAll = st.tasks.length > 0 && st.tasks.every((t) => checks[t.id] !== undefined || t.kind === "singleOptional");
        const left = st.at ? daysUntil(st.at) : null;
        return (
          <section key={st.id} className={doneAll ? "rsv-step is-done" : "rsv-step"}>
            <h4>
              <span className="rsv-step-no">{STEP_NO[i] ?? i + 1}</span>
              {st.title}
              {doneAll && <span className="rsv done">済み</span>}
            </h4>
            <p className="rsv-when">
              🕗 {st.when}
              {left !== null && <span className="rsv-left">{left > 0 ? `あと${left}日` : "受付中"}</span>}
            </p>
            <ul className="rsv-tips">
              {st.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            {shown.length > 0 && (
              <ol className="rsv-list">
                {shown.map((t) => {
                  const done = checks[t.id];
                  no += 1;
                  return (
                    <li key={t.id} id={`rsv-${t.id}`} className={done ? "is-done" : undefined}>
                      <label>
                        <input type="checkbox" checked={done !== undefined} onChange={(e) => onCheck(t.id, e.target.checked)} />
                        <span>
                          <strong>
                            <span className="rsv-order">{no}.</span> {t.title}
                          </strong>
                          {t.kind === "dining" && isHardToBook(t.rideIds[0] ?? "") && <small className="hard">🔥 取りにくい店。いちばん先に</small>}
                          {t.kind !== "singleOptional" && t.kind !== "prep" && <small className={`need need-${t.need}`}>{NECESSITY_LABEL[t.need]}</small>}
                          <small>{t.detail}</small>
                          {t.opens && <small className="rsv-at">📆 予約する日時: {t.opens}</small>}
                          {t.pick && <small className="rsv-at">🕐 選ぶ時間枠: {t.pick}</small>}
                          {done ? (
                            <small className="rsv-by">
                              ✓ 取得済み（{done.by === "toshi" ? "Toshi" : "妻"}・{new Date(done.at).toLocaleDateString("ja-JP")}）
                              {canTime(t) && !done.got && " ／ 取れた時刻を入れると作戦の時刻に反映されます"}
                            </small>
                          ) : (
                            t.kind !== "prep" && <small className="rsv-wish">⬜ まだ取れていません（上の時間枠は希望・おすすめ）</small>
                          )}
                        </span>
                      </label>
                      {canTime(t) && (
                        <div className="rsv-got">
                          {t.rideIds.map((rid) => (
                            <label key={rid}>
                              <span>{t.rideIds.length > 1 ? `${rideById(rid)?.nameJa ?? rid}：` : ""}取れた時刻</span>
                              <input type="time" value={done?.got?.[rid] ?? ""} onChange={(e) => onGotTime(t.id, rid, e.target.value || null)} />
                            </label>
                          ))}
                        </div>
                      )}
                      {t.rideIds.length > 0 && (
                        <div className="rsv-links">
                          {t.rideIds.map((id) => (
                            <button key={id} className="link" onClick={() => onZukan(id, `rsv-${t.id}`)}>
                              📖 {rideById(id)?.nameJa ?? id}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {st.notes.length > 0 && (
              <ul className="rsv-notes">
                {st.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p className="note">作戦を変えると、この一覧も自動で変わります（チェックは残ります）。🔥の店は一般的な傾向です。</p>
    </details>
  );
}

const shortDay = (iso: string): string => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
const PARK_SHORT: Record<ParkId, string> = { MK: "マジック", EP: "エプコット", HS: "スタジオ", AK: "アニマル" };

/** 押すとその場所へ飛ぶ。閉じている折りたたみは開いてから飛ぶ */
function jumpTo(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  if (el instanceof HTMLDetailsElement) el.open = true;
  requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
}

/** 日付ジャンプ（画面の上に貼りつく） */
function DayJump({ days, today, reds, left, onLeft }: { days: readonly DayPlan[]; today: string; reds: number; left: number; onLeft: () => void }) {
  return (
    <nav className="day-jump" aria-label="日付へジャンプ">
      {reds > 0 && (
        <button className="jump red" onClick={() => jumpTo("plan-check")}>
          🔴{reds}
        </button>
      )}
      <button className="jump" onClick={() => jumpTo("plan-rsv")}>
        📅予約
      </button>
      <button className="jump" onClick={() => jumpTo("plan-save")}>
        💾保存
      </button>
      {days.map((d) => (
        <button key={d.date} className={`jump park-${d.morningPark}${d.date === today ? " today" : ""}`} onClick={() => jumpTo(`plan-day-${d.date}`)}>
          <strong>{`${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}`}</strong>
          <small>{PARK_SHORT[d.morningPark]}</small>
        </button>
      ))}
      {left > 0 && (
        <button
          className="jump"
          onClick={() => {
            onLeft();
            jumpTo("plan-left");
          }}
        >
          📦{left}
        </button>
      )}
    </nav>
  );
}

/** 取れた時刻を入れられる予約（食事・Single Pass・Multi Pass の事前予約） */
const canTime = (t: { kind: string; rideIds: string[] }): boolean => (t.kind === "dining" || t.kind === "single" || t.kind === "multi") && t.rideIds.length > 0;

const STEP_NO = ["①", "②", "③", "④", "⑤", "⑥"];

function CrowdBadge({ park, date, crowd }: { park: ParkId; date: string; crowd: CrowdFeed | null }) {
  const c = crowdInfo(park, date, crowd);
  return (
    <p className={`crowd-badge crowd-${c.level}`}>
      {CROWD_ICON[c.level]} 混雑予想{c.basis === "estimate" ? "（推定）" : ""}: <strong>{CROWD_LABEL[c.level]}</strong>
      <small>（{c.reasons.join("・")}）</small>
    </p>
  );
}

const RANK_JA = ["第1優先", "第2優先", "第3優先", "第4優先"];

/** 本命パークの優先順位（第1〜第4）。上の優先ほど混雑予想の低い日に置き、予備日も優先する */
function FocusPicker({
  value,
  onChange,
  plan,
  crowd,
  fixed,
  onPick,
  onClearFixed,
}: {
  value: readonly ParkId[];
  onChange: (p: ParkId[]) => void;
  plan: Plan | null;
  crowd: CrowdFeed | null;
  fixed: FixedParks;
  onPick: (date: string, park: ParkId) => void;
  onClearFixed: () => void;
}) {
  const set = (rank: number, park: ParkId | ""): void => {
    const slots: (ParkId | "")[] = [0, 1, 2, 3].map((i) => value[i] ?? "");
    const prev = slots[rank] ?? "";
    // 同じパークが別の順位にあれば入れ替える
    const other = park ? slots.indexOf(park) : -1;
    if (other >= 0) slots[other] = prev;
    slots[rank] = park;
    onChange(slots.filter((p): p is ParkId => p !== ""));
  };
  const days = TRIP.parkDays;
  return (
    <div className="focus-picker">
      <p className="note">行きたい順に選んでください。第1優先ほど空いている日に置きます（予備日も第1優先のパークを優先）。</p>
      <div className="focus-ranks">
        {[0, 1, 2, 3].map((i) => (
          <label key={i}>
            <span>{RANK_JA[i]}</span>
            <select value={value[i] ?? ""} onChange={(e) => set(i, e.target.value as ParkId | "")} disabled={i > value.length}>
              <option value="">決めない</option>
              {PARKS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameJa}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <table className="crowd-table">
        <caption>混雑予想（{CROWD_ICON.low}空き気味 {CROWD_ICON.mid}ふつう {CROWD_ICON.high}混む {CROWD_ICON.peak}とても混む）</caption>
        <thead>
          <tr>
            <th></th>
            {PARKS.map((p) => (
              <th key={p.id}>{PARK_SHORT[p.id]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((date) => {
            const day = plan?.days.find((d) => d.date === date);
            return (
              <tr key={date}>
                <th>{dayLabel(date)}</th>
                {PARKS.map((p) => {
                  const c = crowdInfo(p.id, date, crowd);
                  const mine = day?.morningPark === p.id;
                  const pinned = fixed[date] === p.id;
                  return (
                    <td key={p.id} className={`${mine ? "mine" : ""}${pinned ? " pinned" : ""}`}>
                      <button
                        className="crowd-cell"
                        title={c.reasons.join("・")}
                        aria-pressed={mine}
                        aria-label={`${dayLabel(date)}を${p.nameJa}の日にする（${CROWD_LABEL[c.level]}）`}
                        onClick={() => onPick(date, p.id)}
                      >
                        {pinned ? "📌" : CROWD_ICON[c.level]}
                        <small>
                          {CROWD_LABEL[c.level]}
                          {crowd && c.basis === "estimate" && "*"}
                        </small>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {plan && (
        <p className="note">
          枠で囲んだところが、今の作戦で行くパークです。<strong>マスを押すと、その日をそのパークに決められます（📌）。</strong>作戦全体（乗り物・食事・時刻・事前予約）がすぐ組み直されます。もう一度押すと自動に戻ります。
        </p>
      )}
      {Object.keys(fixed).length > 0 && (
        <button className="mini" onClick={onClearFixed}>
          📌 手で決めた日をすべて自動に戻す（{Object.keys(fixed).length}日）
        </button>
      )}
      {crowd ? (
        <p className="note crowd-src">
          📊 出典:{" "}
          <a href={crowd.source.url} target="_blank" rel="noreferrer">
            {crowd.source.name}
          </a>
          （{crowd.fetchedAt}取得。{crowd.method}）。値のないところ（*）は一般的な傾向からの推定です。
        </p>
      ) : (
        <p className="note crowd-src">
          ⚠️ まだ混雑予想サイトの値を取り込めていないため、一般的な傾向から作った推定です（土曜がいちばん混み水曜がいちばん空く、エプコットはフラワー＆ガーデンの週末が混む、5/4はスタジオがスター・ウォーズの日で混む。参考:{" "}
          <a href={CROWD_SOURCE.url} target="_blank" rel="noreferrer">
            {CROWD_SOURCE.label}
          </a>
          ）。
        </p>
      )}
    </div>
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
                  {e.date ? `元: ${dayLabel(e.date)} ${SLOT_NAMES[e.slot]}` : "どの日にも入っていなかったもの（まとめて外した）"}
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
