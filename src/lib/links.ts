import type { Ride } from "../types";

export interface RideLink {
  label: string;
  url: string;
}

const google = (q: string): string => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const youtube = (q: string): string => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/**
 * アトラクションの内容を調べるリンク。
 * 公式ページのURLは変わることがあり、推測で書くと切れたリンクになるため、
 * 確実に目的のページにたどり着ける検索リンクにしている。
 */
export function rideLinks(ride: Ride): RideLink[] {
  return [
    { label: "動画で見る", url: youtube(`${ride.nameEn} ride through POV Walt Disney World`) },
    { label: "日本語で調べる", url: google(`${ride.nameJa} WDW ${ride.nameEn}`) },
    { label: "公式サイト", url: google(`site:disneyworld.disney.go.com ${ride.nameEn}`) },
  ];
}
