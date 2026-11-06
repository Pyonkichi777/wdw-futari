import { useState } from "react";
import { gotTimeText, isClock, type GotTime } from "../lib/checks";
import { useDraftGuard } from "../lib/reloadSafety";
import { authErrorMessage } from "../lib/errors";

/** 取得枠は開始・終了を揃えて保存。入力途中は共有せず、再読込から保護する */
export function BookingTimeField({ name, window, value, onSave }: {
  name: string; window: boolean; value?: GotTime; onSave: (value: GotTime | null, expected: GotTime | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState<{ from: string; to: string; base: GotTime | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const saved = { from: typeof value === "string" ? value : value?.from ?? "", to: typeof value === "object" ? value.to : "" };
  const shown = draft ?? saved;
  const dirty = draft !== null;
  const conflict = draft !== null && JSON.stringify(draft.base) !== JSON.stringify(value ?? null);
  useDraftGuard(dirty || busy);
  const valid = isClock(shown.from) && (!window || (isClock(shown.to) && shown.from < shown.to));
  const save = async (next: GotTime | null): Promise<void> => {
    setBusy(true); setMsg(null);
    try { await onSave(next, draft ? draft.base : value ?? null); setDraft(null); setMsg(next ? "保存しました" : "時刻を消しました（取得済みチェックはそのまま）"); }
    catch (e) { setMsg(authErrorMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <fieldset className="booking-time" disabled={busy}>
      <legend>{name}：{window ? "取れた到着枠" : "取れた予約時刻"}</legend>
      {value && <p className="note">保存済み：{gotTimeText(value)}{window && typeof value === "string" ? "（旧入力。終了時刻を確認して枠として保存してください）" : ""}</p>}
      <div className="booking-inputs">
        <label>{window ? "開始" : "予約時刻"}<input aria-label={`${name} ${window ? "到着枠の開始" : "予約時刻"}`} type="time" value={shown.from} onChange={(e) => { setMsg(null); setDraft({ ...shown, base: draft ? draft.base : value ?? null, from: e.target.value }); }} /></label>
        {window && <label>終了<input aria-label={`${name} 到着枠の終了`} type="time" value={shown.to} onChange={(e) => { setMsg(null); setDraft({ ...shown, base: draft ? draft.base : value ?? null, to: e.target.value }); }} /></label>}
        <button className="mini" disabled={!dirty || !valid || conflict} onClick={() => void save(window ? { from: shown.from, to: shown.to } : shown.from)}>保存</button>
        {dirty && <button className="mini" onClick={() => { setDraft(null); setMsg(null); }}>入力を戻す</button>}
        {value && <button className="mini" disabled={dirty} onClick={() => void save(null)}>時刻を消す</button>}
      </div>
      {conflict && <p role="alert" className="note">別の画面で予約が更新されています。「入力を戻す」で最新の内容を確認してから入力してください。</p>}
      {window && <p className="note">公式アプリに表示された同じ日の開始・終了を入力してください。終了は自動で補いません。</p>}
      {dirty && !valid && <p className="note">{window ? "開始より後の終了時刻まで入力して保存してください。" : "予約時刻を入力して保存してください。"}</p>}
      {msg && <p role="status" className="note">{msg}</p>}
    </fieldset>
  );
}
