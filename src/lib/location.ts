import type { ParkId } from "../types";

/** 各パークとホテルの中心のおおよその位置（緯度・経度）と、中にいるとみなす半径（km） */
export const PLACES: readonly { id: ParkId | "HOTEL"; name: string; lat: number; lng: number; radiusKm: number }[] = [
  { id: "MK", name: "マジックキングダム", lat: 28.4177, lng: -81.5812, radiusKm: 0.9 },
  { id: "EP", name: "エプコット", lat: 28.3747, lng: -81.5494, radiusKm: 1.2 },
  { id: "HS", name: "ハリウッド・スタジオ", lat: 28.3575, lng: -81.5583, radiusKm: 0.8 },
  { id: "AK", name: "アニマルキングダム", lat: 28.3553, lng: -81.5901, radiusKm: 1.3 },
  { id: "HOTEL", name: "ポップセンチュリー", lat: 28.3519, lng: -81.5424, radiusKm: 0.7 },
];

/** 2点間の距離（km） */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface WhereResult {
  /** 中にいる場所。いなければ null */
  inside: (typeof PLACES)[number] | null;
  nearest: (typeof PLACES)[number];
  km: number;
}

export function whereAmI(pos: { lat: number; lng: number }): WhereResult {
  const ranked = PLACES.map((p) => ({ p, km: distanceKm(pos, p) })).sort((a, b) => a.km - b.km);
  const first = ranked[0]!;
  return { inside: first.km <= first.p.radiusKm ? first.p : null, nearest: first.p, km: first.km };
}
