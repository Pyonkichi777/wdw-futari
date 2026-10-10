import { REVIEWS } from "../data/reviews";
import type { Ride } from "../types";

export interface RideLink {
  label: string;
  url: string;
}

export const OFFICIAL_SITE = "https://disneyworld.disney.go.com";

const google = (q: string): string => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const youtube = (q: string): string => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/**
 * アトラクションの内容を調べるリンク。
 * 公式ページは2026-10-10に開けることを確認したURL。動画と日本語の解説は検索リンク。
 */
export function rideLinks(ride: Ride): RideLink[] {
  return [
    { label: "動画で見る", url: youtube(`${ride.nameEn} ride through POV Walt Disney World`) },
    { label: "日本語で調べる", url: google(`${ride.nameJa} WDW ${ride.nameEn}`) },
    { label: "公式サイト", url: `${OFFICIAL_SITE}${ride.officialPath}` },
    { label: "口コミを読む", url: REVIEWS[ride.id]?.url ?? google(`トリップアドバイザー ${ride.nameEn} 口コミ`) },
  ];
}
