import { useState } from "react";
import { rideById } from "../data/rides";
import type { Checks } from "../lib/checks";
import type { HoursFeed } from "../lib/hours";
import type { Plan } from "../lib/plan";
import { planToText } from "../lib/planText";

/** 電波がないときのために、作戦を文字で控える（コピー・メモに共有・ファイルに保存） */
export function PlanTextPanel({ plan, checks, hours }: { plan: Plan; checks: Checks; hours: HoursFeed | null }) {
  const [msg, setMsg] = useState<string | null>(null);
  if (plan.days.length === 0) return null;
  const text = (): string => planToText(plan, checks, rideById, hours, new Date());
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text());
      setMsg("📋 コピーしました。メモアプリなどに貼り付けて保存してください");
    } catch {
      setMsg("コピーできませんでした。「ファイルに保存」を使ってください");
    }
  };
  const share = async (): Promise<void> => {
    try {
      await navigator.share({ title: "作戦の控え", text: text() });
    } catch {
      // 共有を閉じただけのときは何もしない
    }
  };
  const download = (): void => {
    const url = URL.createObjectURL(new Blob([text()], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `作戦の控え_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("💾 ファイルに保存しました（「ファイル」アプリなどで開けます）");
  };
  return (
    <details className="plan-day text-panel" id="plan-text">
      <summary>
        <strong>📋 作戦を文字で控える（電波がないとき用）</strong>
      </summary>
      <p className="note">
        日ごとの予定・目安時刻・取れた予約の時刻・予約の状況を、文字だけにして端末に控えます。アプリは前に開いた作戦を端末に残しますが、念のため出発前と作戦を変えたときに控えておくと安心です。控えた後の変更は入らないので、控えた日時を書き込みます。
      </p>
      <div className="text-actions">
        <button className="mini" onClick={() => void copy()}>
          コピー
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button className="mini" onClick={() => void share()}>
            メモなどに共有
          </button>
        )}
        <button className="mini" onClick={download}>
          ファイルに保存
        </button>
      </div>
      {msg && <p className="snap-msg">{msg}</p>}
    </details>
  );
}
