import type { ParkId } from "../types";

/** 公式の営業時間（public/hours.json）。2027年5月分は、出発の1〜2ヶ月前に公開されたら毎朝の巡回が書き込む */
export interface ParkHours {
  /** 開園（"HH:MM"、現地時刻） */
  open: string;
  close: string;
  /** 開園前入園（ホテル宿泊者） */
  early?: string;
  /** 夜の延長（対象ホテルのみ） */
  extendedClose?: string;
}

export interface HoursFeed {
  source: { name: string; url: string };
  fetchedAt: string;
  days: Record<string, Partial<Record<ParkId, ParkHours>>>;
}

const HM = /^\d{2}:\d{2}$/;
const PARK_KEYS: readonly ParkId[] = ["MK", "EP", "HS", "AK"];

export const toMinutes = (hm: string): number => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

export function parseHoursFeed(data: unknown): HoursFeed | null {
  if (typeof data !== "object" || data === null) return null;
  const o = data as Record<string, unknown>;
  const src = (typeof o.source === "object" && o.source !== null ? o.source : {}) as Record<string, unknown>;
  if (typeof src.name !== "string" || typeof src.url !== "string" || !src.url.startsWith("https://")) return null;
  const raw = (typeof o.days === "object" && o.days !== null ? o.days : {}) as Record<string, unknown>;
  const days: HoursFeed["days"] = {};
  for (const [date, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof v !== "object" || v === null) continue;
    const row: Partial<Record<ParkId, ParkHours>> = {};
    for (const k of PARK_KEYS) {
      const h = (v as Record<string, unknown>)[k] as Record<string, unknown> | undefined;
      if (!h || typeof h.open !== "string" || typeof h.close !== "string" || !HM.test(h.open) || !HM.test(h.close)) continue;
      row[k] = {
        open: h.open,
        close: h.close,
        ...(typeof h.early === "string" && HM.test(h.early) ? { early: h.early } : {}),
        ...(typeof h.extendedClose === "string" && HM.test(h.extendedClose) ? { extendedClose: h.extendedClose } : {}),
      };
    }
    if (Object.keys(row).length > 0) days[date] = row;
  }
  if (Object.keys(days).length === 0) return null;
  return { source: { name: src.name, url: src.url }, fetchedAt: typeof o.fetchedAt === "string" ? o.fetchedAt : "", days };
}

/** public/hours.json を読む（まだ無ければ null） */
export async function fetchHoursFeed(): Promise<HoursFeed | null> {
  const res = await fetch(`${import.meta.env.BASE_URL}hours.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  return parseHoursFeed(await res.json().catch(() => null));
}
