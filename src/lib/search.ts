import type { Ride } from "../types";
import { KIND_LABEL } from "./access";
import { PARKS } from "../data/parks";

/**
 * 検索用に文字をそろえる。
 * 全角英数→半角、英字は小文字、カタカナ→ひらがな、空白・中黒・記号は無視
 * （「ぷーさん」「プーさん」「Pooh」「プー」のどれでも当たるように）
 */
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・･、。,.!！?？:：'’"“”()（）「」『』\-–—&＆]/g, "");
}

/** 検索の対象にする文字（名前・英語名・説明・キャラクター・パーク・種類） */
function haystack(ride: Ride): string {
  const park = PARKS.find((p) => p.id === ride.park);
  return normalize([ride.nameJa, ride.nameEn, ride.description, ride.greet?.characters ?? "", ride.dining?.characters ?? "", ride.dining?.place ?? "", ride.dining?.cuisine ?? "", park?.nameJa ?? "", KIND_LABEL[ride.kind]].join(" "));
}

const cache = new Map<string, string>();

/** 空白で区切った言葉が、すべて含まれていれば当たり。空なら全部当たり */
export function matchesQuery(ride: Ride, query: string): boolean {
  const words = query.split(/[\s　]+/).map(normalize).filter((w) => w !== "");
  if (words.length === 0) return true;
  let h = cache.get(ride.id);
  if (h === undefined) {
    h = haystack(ride);
    cache.set(ride.id, h);
  }
  const text = h;
  return words.every((w) => text.includes(w));
}
