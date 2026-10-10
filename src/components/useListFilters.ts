import { useCallback, useState } from "react";
import { EMPTY_FILTERS, parseFilters, type ListFilters } from "../lib/listFilters";

const KEY_PREFIX = "wdw-futari:filters:";

function load(key: string): ListFilters {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    return raw ? parseFilters(JSON.parse(raw)) : EMPTY_FILTERS;
  } catch {
    return EMPTY_FILTERS;
  }
}

/** 画面ごとの絞り込み条件。この端末に保存し、タブを移ってもアプリを閉じても残す */
export function useListFilters(key: string): [ListFilters, (patch: Partial<ListFilters>) => void] {
  const [filters, setFilters] = useState<ListFilters>(() => load(key));
  const update = useCallback(
    (patch: Partial<ListFilters>): void => {
      setFilters((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(KEY_PREFIX + key, JSON.stringify(next));
        } catch {
          // 保存できなくても、この画面を開いている間は効く
        }
        return next;
      });
    },
    [key],
  );
  return [filters, update];
}
