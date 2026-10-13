import { useState } from "react";
import { parkName } from "../data/parks";
import type { Plan } from "../lib/plan";
import { MAX_SNAPSHOTS, type PlanSnapshot } from "../lib/snapshots";
import { PERSON_LABEL } from "../lib/store";
import type { PersonId } from "../types";

const when = (ms: number): string =>
  new Date(ms).toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
const md = (iso: string): string => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/** 日割りのひとこと（例: 5/1 エプコット・5/2 マジックキングダム…） */
export const planSummary = (p: Plan): string => (p.days.length === 0 ? "（まだ作戦なし）" : p.days.map((d) => `${md(d.date)} ${parkName(d.morningPark)}`).join("・"));

/** 作戦の保存（2人それぞれが持つ。2人合計10件まで）。保存した作戦にいつでも戻せる */
export function SnapshotPanel({
  me,
  list,
  plan,
  onSave,
  onDelete,
  onRestore,
}: {
  me: PersonId;
  list: readonly PlanSnapshot[];
  plan: Plan;
  onSave: (name: string, replaceOldestOwn: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRestore: (snap: PlanSnapshot) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const full = list.length >= MAX_SNAPSHOTS;
  const myOldest = [...list].filter((s) => s.by === me).sort((a, b) => a.savedAt - b.savedAt)[0];

  const save = async (): Promise<void> => {
    let replace = false;
    if (full) {
      if (!myOldest) {
        setMsg(`2人合計で${MAX_SNAPSHOTS}件いっぱいで、あなたの保存がありません。相手に不要な保存を消してもらってください。`);
        return;
      }
      if (!window.confirm(`2人合計で${MAX_SNAPSHOTS}件いっぱいです。あなたのいちばん古い保存「${myOldest.name}」（${when(myOldest.savedAt)}）を消して保存しますか？`)) return;
      replace = true;
    }
    setBusy(true);
    setMsg(null);
    try {
      await onSave(name.trim() || `${PERSON_LABEL[me]}の作戦（名前なし）`, replace);
      setName("");
      setMsg("💾 保存しました");
    } catch (e) {
      setMsg(e instanceof Error && e.message === "full" ? `2人合計で${MAX_SNAPSHOTS}件いっぱいです。不要な保存を消してから保存してください。` : "保存できませんでした。電波のよいところでもう一度試してください。");
    } finally {
      setBusy(false);
    }
  };

  const people: PersonId[] = [me, me === "toshi" ? "tsuma" : "toshi"];
  return (
    <details className="plan-day snap-panel" id="plan-save">
      <summary>
        <strong>💾 作戦の保存</strong>
        <span className="note">
          {list.length}/{MAX_SNAPSHOTS}件（2人合計）
        </span>
      </summary>
      <p className="note">今の作戦（日割り・乗り物・食事・時刻・外したもの・手で決めた日）をそのまま保存します。保存は2人それぞれが持ち、保存日時を表示します。保存した作戦にはいつでも戻せます。</p>
      <div className="snap-save">
        <input type="text" value={name} maxLength={40} placeholder="名前（例: アニマル優先の案）" onChange={(e) => setName(e.target.value)} aria-label="保存する名前" />
        <button className="primary" disabled={busy || plan.days.length === 0} onClick={() => void save()}>
          {full ? "入れ替えて保存" : "今の作戦を保存"}
        </button>
      </div>
      {full && <p className="note warn-text">2人合計で{MAX_SNAPSHOTS}件いっぱいです。保存すると、あなたのいちばん古い保存と入れ替えます。</p>}
      {msg && <p className="snap-msg">{msg}</p>}
      {people.map((p) => {
        const mine = list.filter((s) => s.by === p);
        return (
          <section key={p} className="snap-group">
            <h4>
              {PERSON_LABEL[p]}の保存（{mine.length}件）
            </h4>
            {mine.length === 0 && <p className="empty">まだありません</p>}
            <ul className="snap-list">
              {mine.map((s) => (
                <li key={s.id}>
                  <div className="snap-head">
                    <strong>{s.name}</strong>
                    <small>🕒 {when(s.savedAt)} 保存</small>
                    <small>{planSummary(s.plan)}</small>
                  </div>
                  <div className="snap-actions">
                    <button
                      className="mini"
                      onClick={() => {
                        if (window.confirm(`「${s.name}」（${when(s.savedAt)}）の作戦に戻します。今の作戦は2人とも置き換わります（予約のチェックはそのまま）。今の作戦を残したいときは、先に保存してください。よろしいですか？`)) onRestore(s);
                      }}
                    >
                      この作戦に戻す
                    </button>
                    {s.by === me && (
                      <button
                        className="mini danger"
                        onClick={() => {
                          if (window.confirm(`「${s.name}」（${when(s.savedAt)}）を削除します。よろしいですか？`)) void onDelete(s.id);
                        }}
                      >
                        削除
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </details>
  );
}
