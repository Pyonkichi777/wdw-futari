import type { ParkId, Ride } from "../types";
import type { DayPlan } from "./plan";

export const PARK_SHORT: Record<ParkId, string> = { MK: "マジック", EP: "エプコット", HS: "スタジオ", AK: "アニマル" };

/** 設定上の朝パークではなく、実際に予定がある場所を日付ボタンと控えに表示する */
export function dayVisit(day: DayPlan, rideById: (id: string) => Ride | undefined): { label: string; park?: ParkId } {
  const items = day.items.flatMap((i) => {
    const ride = rideById(i.rideId);
    return ride ? [{ item: i, ride }] : [];
  });
  if (items.length === 0) return { label: "予定なし" };
  const parks = [...new Set(items.filter((x) => x.ride.dining?.inPark !== false).map((x) => x.ride.park))];
  if (parks.length === 0) return { label: "ホテル等" };
  const first = items[0]!.item.slot;
  const prefix = first === "dinner" || first === "night" ? "夕 " : first === "pm" ? "午後 " : first === "lunch" ? "昼 " : "";
  return { label: prefix + parks.map((p) => PARK_SHORT[p]).join("→"), park: parks[0] };
}
