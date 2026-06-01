import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "catalog:favorites:v1";
const EVENT = "favorites:changed";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignore */
  }
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>(() => read());

  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const set = useCallback((next: string[]) => {
    const unique = Array.from(new Set(next));
    write(unique);
    setIds(unique);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      const current = read();
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      set(next);
    },
    [set],
  );

  const remove = useCallback(
    (id: string) => {
      set(read().filter((x) => x !== id));
    },
    [set],
  );

  const clear = useCallback(() => set([]), [set]);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, has, toggle, remove, clear };
}
