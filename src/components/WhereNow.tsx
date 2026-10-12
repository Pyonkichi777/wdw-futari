import { useState } from "react";
import { parkName } from "../data/parks";
import { whereAmI, type WhereResult } from "../lib/location";
import { SLOT_LABEL, type Plan, type Slot } from "../lib/plan";
import type { ParkId } from "../types";

/** オーランドの今日の日付（"2027-05-02"） */
export const todayInOrlando = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/** オーランドの今の時刻から、作戦のどの時間の枠か */
export function slotNow(now: Date = new Date()): Slot {
  const [h = 0, m = 0] = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(now)
    .split(":")
    .map(Number);
  const t = h * 60 + m;
  if (t < 9 * 60) return "early";
  if (t < 11 * 60 + 30) return "am";
  if (t < 13 * 60 + 30) return "lunch";
  if (t < 17 * 60) return "pm";
  if (t < 19 * 60) return "dinner";
  return "night";
}

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; where: WhereResult } | { kind: "error"; message: string };

/** 「今どのパークにいるか」をスマホの位置情報で調べる。旅行中は今日の予定と比べる */
export function WhereNow({ plan, onHere }: { plan: Plan; onHere: (p: ParkId | "HOTEL" | null) => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const today = plan.days.find((d) => d.date === todayInOrlando());
  const slot = slotNow();
  const plannedPark = today ? (slot === "dinner" || slot === "night" ? today.eveningPark : today.morningPark) : null;

  const locate = (): void => {
    if (!("geolocation" in navigator)) {
      setState({ kind: "error", message: "このスマホでは位置情報が使えません。" });
      return;
    }
    setState({ kind: "busy" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const where = whereAmI({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setState({ kind: "done", where });
        onHere(where.inside?.id ?? null);
      },
      (err) =>
        setState({
          kind: "error",
          message: err.code === err.PERMISSION_DENIED ? "位置情報の利用が許可されていません。iPhoneの「設定 → プライバシー → 位置情報サービス」で、Safari（またはこのアプリ）を「使用中のみ許可」にしてください。" : "位置を取得できませんでした。電波のよい場所でもう一度押してください。",
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  return (
    <div className="where-now">
      {today && plannedPark && (
        <p className="where-plan">
          🗓 今日の予定: 今は「{SLOT_LABEL[slot]}」の時間 → <strong>{parkName(plannedPark)}</strong>
        </p>
      )}
      <button className="where-btn" onClick={locate} disabled={state.kind === "busy"}>
        📍 {state.kind === "busy" ? "調べています…" : "今いるパークを調べる"}
      </button>
      {state.kind === "done" && (
        <p className="where-result">
          {state.where.inside ? (
            <>
              今いるのは <strong>{state.where.inside.name}</strong>
              {plannedPark && state.where.inside.id !== "HOTEL" && state.where.inside.id !== plannedPark && <span className="where-warn">（予定では今は{parkName(plannedPark)}の時間です）</span>}
            </>
          ) : (
            <>
              パークの外にいます（いちばん近いのは{state.where.nearest.name}、約{state.where.km.toFixed(1)}km）
            </>
          )}
        </p>
      )}
      {state.kind === "error" && <p className="where-result where-warn">{state.message}</p>}
      <p className="note">位置は調べるときだけ使い、どこにも保存・送信しません。</p>
    </div>
  );
}
