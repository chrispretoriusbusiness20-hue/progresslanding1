import { useCallback, useSyncExternalStore } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: string | null;
  image: string | null;
  quantity: number;
}

const STORAGE_KEY = "progress_cart";
const EMPTY: CartItem[] = [];
const listeners = new Set<() => void>();
let cache: CartItem[] | null = null;

function read(): CartItem[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(items: CartItem[]) {
  cache = items;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Parses "R14 918,00" style ZAR strings into a number. */
export function parseZar(price: string | null): number | null {
  if (!price) return null;
  const n = Number(price.replace(/[^\d,.-]/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + (parseZar(i.price) ?? 0) * i.quantity, 0);
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);

  const add = useCallback((item: Omit<CartItem, "quantity">) => {
    const current = read();
    const existing = current.find((i) => i.id === item.id);
    write(
      existing
        ? current.map((i) => (i.id === item.id ? { ...i, quantity: Math.min(i.quantity + 1, 50) } : i))
        : [...current, { ...item, quantity: 1 }],
    );
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    const q = Math.max(1, Math.min(50, Math.round(quantity)));
    write(read().map((i) => (i.id === id ? { ...i, quantity: q } : i)));
  }, []);

  const remove = useCallback((id: string) => write(read().filter((i) => i.id !== id)), []);
  const clear = useCallback(() => write([]), []);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  return { items, count, add, setQuantity, remove, clear };
}
