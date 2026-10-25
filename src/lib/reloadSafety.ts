import { useEffect, useRef, useSyncExternalStore } from "react";

const blockers = new Set<symbol>();
const listeners = new Set<() => void>();
export const reloadBlocked = (): boolean => blockers.size > 0;
const subscribe = (cb: () => void): (() => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const useReloadBlocked = (): boolean => useSyncExternalStore(subscribe, reloadBlocked);
export function blockReload(): () => void {
  const id = Symbol();
  blockers.add(id);
  listeners.forEach((cb) => cb());
  return () => { blockers.delete(id); listeners.forEach((cb) => cb()); };
}
/** 入力途中の下書きと、保存が完了していない変更を再読込から守る */
export function useDraftGuard(dirty: boolean): void {
  const release = useRef<(() => void) | null>(null);
  // 次のクリックを待たず、入力を描画した時点で更新ボタンにも反映する
  useEffect(() => {
    if (dirty) release.current = blockReload();
    return () => { release.current?.(); release.current = null; };
  }, [dirty]);
}
export async function protectWrite<T>(write: () => Promise<T>): Promise<T> {
  const release = blockReload();
  try { return await write(); } finally { release(); }
}
