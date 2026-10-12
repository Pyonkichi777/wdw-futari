import type { GreetStyle, Ride, RideKind } from "../types";
import { diningLines } from "./dining";
import { MOTION_LABEL, motionDots, motionOf } from "./motion";

export const KIND_LABEL: Record<RideKind, string> = {
  ride: "乗り物",
  show: "ショー・シアター",
  parade: "パレード",
  night: "夜のショー",
  walk: "散策",
  greet: "グリーティング",
  dining: "レストラン",
};

const GREET_STYLE_LABEL: Record<GreetStyle, string> = {
  always: "決まった時間帯ならいつでも並んで会える",
  timed: "時刻を決めて登場（1日に数回。当日の時刻は公式アプリで確認）",
  roaming: "パーク内を歩き回っている（見つけたら会える）",
};

export interface AccessLine {
  label: string;
  value: string;
  /** 強調したい行（有料の個別購入、人気グループなど） */
  strong?: boolean;
}

/** 「どのチケット・パスで利用できるか」を説明する行（図鑑のカードに表示） */
export function accessLines(ride: Ride): AccessLine[] {
  const lines: AccessLine[] = [
    { label: "入園チケット", value: "購入済みの5日間パークホッパー券で利用できる（追加料金なし）" },
  ];

  if (ride.dining) return diningLines(ride);

  if (ride.greet) {
    lines.push(
      { label: "会えるキャラクター", value: ride.greet.characters, strong: true },
      { label: "会い方", value: GREET_STYLE_LABEL[ride.greet.style] },
      { label: "時短パス", value: "なし（グリーティングは時短パスの対象外。並んで会う）" },
    );
    return lines;
  }

  switch (ride.lightningLane) {
    case "single":
      lines.push({
        label: "時短パス",
        value: "Single Pass専用（このアトラクション専用の有料パス。1回ずつ購入、1人1日2本まで）。Multi Passでは乗れない",
        strong: true,
      });
      break;
    case "multi":
      lines.push(
        ride.multiPassTier === 1
          ? { label: "時短パス", value: "Multi Passで乗れる（人気グループ：事前予約の3本のうち、このグループからは1日1つまで）", strong: true }
          : { label: "時短パス", value: "Multi Passで乗れる（事前予約の3本に入れられる）" },
      );
      break;
    case "none":
      lines.push({ label: "時短パス", value: "なし（Multi PassでもSingle Passでも優先されない。並ぶか、上演時刻に行くだけ）" });
      break;
  }

  if (ride.kind === "ride") {
    lines.push({
      label: "開園前入園",
      value: ride.earlyEntry ? "対象（直営ホテル宿泊者は開園30分前から乗れる）" : "対象外（開園後に向かう）",
      strong: ride.earlyEntry,
    });
  }
  const m = motionOf(ride);
  const basis = m.source === "allears" ? `All Ears: ${m.allEars ?? ""}` : "乗り物の動きと口コミから推定";
  lines.push({
    label: "酔い度",
    value: `${motionDots(m.level)} ${MOTION_LABEL[m.level]}（${basis}）${m.note ? `。${m.note}` : ""}`,
    strong: m.level >= 3,
  });
  if (ride.singleRider) lines.push({ label: "1人乗り専用の列", value: "あり（夫婦で別々の回に乗る代わりに早く乗れる）" });
  return lines;
}
