import { expect, it } from "vitest";
import { rideById } from "../data/rides";
import { dayVisit } from "./dayLabel";

it("R02: 朝の設定がアニマルでも夕食だけなら夕マジック、空なら予定なし", () => {
  const day = { date: "2027-05-05", morningPark: "AK" as const, eveningPark: "MK" as const, items: [{ rideId: "dine-cinderella-royal-table", slot: "dinner" as const, method: "meal" as const }] };
  expect(dayVisit(day, rideById)).toEqual({ label: "夕 マジック", park: "MK" });
  expect(dayVisit({ ...day, items: [] }, rideById)).toEqual({ label: "予定なし" });
});
