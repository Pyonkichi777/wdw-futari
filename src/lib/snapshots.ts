import type { PersonId } from "../types";
import { parsePlan, type Plan } from "./plan";

/** 作戦の保存（2人それぞれが持つ。2人合計で MAX_SNAPSHOTS 件まで） */
export interface PlanSnapshot {
  id: string;
  /** 保存した人（その人の保存として持つ。削除できるのも本人だけ） */
  by: PersonId;
  /** 保存日時（ミリ秒） */
  savedAt: number;
  name: string;
  plan: Plan;
}

export const MAX_SNAPSHOTS = 10;

const isPerson = (v: unknown): v is PersonId => v === "toshi" || v === "tsuma";

/** 保存データを読み直す（壊れた項目は捨てる。新しい順） */
export function parseSnapshots(data: unknown): PlanSnapshot[] {
  const items = typeof data === "object" && data !== null ? (data as Record<string, unknown>).items : null;
  if (!Array.isArray(items)) return [];
  return items
    .flatMap((x: unknown): PlanSnapshot[] => {
      if (typeof x !== "object" || x === null) return [];
      const o = x as Record<string, unknown>;
      if (typeof o.id !== "string" || !isPerson(o.by) || typeof o.savedAt !== "number" || typeof o.name !== "string") return [];
      return [{ id: o.id, by: o.by, savedAt: o.savedAt, name: o.name, plan: parsePlan(o.plan) }];
    })
    .sort((a, b) => b.savedAt - a.savedAt);
}

export type AddResult = { ok: true; list: PlanSnapshot[]; removed: PlanSnapshot | null } | { ok: false; reason: "full" };

/**
 * 保存を1件足す。2人合計で上限に達していたら、replaceOldestOwn のときだけ「自分のいちばん古い保存」と入れ替える
 * （相手の保存は勝手に消さない）
 */
export function addSnapshot(list: readonly PlanSnapshot[], snap: PlanSnapshot, replaceOldestOwn: boolean): AddResult {
  if (list.length < MAX_SNAPSHOTS) return { ok: true, list: [snap, ...list], removed: null };
  const own = list.filter((s) => s.by === snap.by).sort((a, b) => a.savedAt - b.savedAt)[0];
  if (!replaceOldestOwn || !own) return { ok: false, reason: "full" };
  return { ok: true, list: [snap, ...list.filter((s) => s.id !== own.id)], removed: own };
}

/** 削除は本人の保存だけ */
export const removeSnapshot = (list: readonly PlanSnapshot[], id: string, by: PersonId): PlanSnapshot[] => list.filter((s) => !(s.id === id && s.by === by));

export const newSnapshotId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** 保存データの形（Firestore・端末内に置く形。undefined を含めない） */
export const toStored = (list: readonly PlanSnapshot[]): { items: unknown[] } => ({ items: JSON.parse(JSON.stringify(list)) as unknown[] });
