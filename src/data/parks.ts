import type { Park, ParkId } from "../types";

export const PARKS: readonly Park[] = [
  { id: "MK", nameJa: "マジックキングダム", nameEn: "Magic Kingdom" },
  { id: "EP", nameJa: "エプコット", nameEn: "EPCOT" },
  { id: "HS", nameJa: "ハリウッド・スタジオ", nameEn: "Hollywood Studios" },
  { id: "AK", nameJa: "アニマルキングダム", nameEn: "Animal Kingdom" },
];

export const parkName = (id: ParkId): string => PARKS.find((p) => p.id === id)?.nameJa ?? id;
