import type { Ride, RideKind } from "../types";

export const KIND_LABEL: Record<RideKind, string> = {
  ride: "乗り物",
  show: "ショー・シアター",
  parade: "パレード",
  night: "夜のショー",
  walk: "散策",
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

  switch (ride.lightningLane) {
    case "single":
      lines.push({
        label: "時短パス",
        value: "Lightning Lane Single Pass（このアトラクション専用の有料パス。1回ずつ購入、1人1日2本まで）。Multi Passでは取れない",
        strong: true,
      });
      break;
    case "multi":
      lines.push(
        ride.multiPassTier === 1
          ? { label: "時短パス", value: "Lightning Lane Multi Pass（人気グループ：事前予約の3本のうち、このグループからは1日1つまで）", strong: true }
          : { label: "時短パス", value: "Lightning Lane Multi Pass（事前予約の3本に入れられる）" },
      );
      break;
    case "none":
      lines.push({ label: "時短パス", value: "なし（並ぶか、上演時刻に行くだけ）" });
      break;
  }

  if (ride.kind === "ride") {
    lines.push({
      label: "開園前入園",
      value: ride.earlyEntry ? "対象（直営ホテル宿泊者は開園30分前から乗れる）" : "対象外（開園後に向かう）",
      strong: ride.earlyEntry,
    });
  }
  if (ride.singleRider) lines.push({ label: "1人乗り専用の列", value: "あり（夫婦で別々の回に乗る代わりに早く乗れる）" });
  return lines;
}
