// Client-side cart-count badge — keeps the header / bottom-nav cart badge live,
// mirroring lib/wishlist.ts. The cart itself lives on the backend
// (GET /cart, POST /cart/add); this only caches the *count* (total units) so
// the badge updates instantly when an item is added and survives reloads.
// refresh() reconciles the cached value with the server.

import { api } from "@/lib/api";

const KEY = "epey.cart.count";
const EVENT = "epey:cart-changed";

function read(): number {
  if (typeof window === "undefined") return 0;
  const n = Number(window.localStorage.getItem(KEY));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function write(n: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, String(Math.max(0, Math.round(n))));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // localStorage can throw in private mode / over quota — fail silently.
  }
}

export const cartBadge = {
  get: read,

  set(n: number) { write(n); },

  /** Optimistic +/- after an add/remove so the badge reacts instantly. */
  bump(delta: number) { write(read() + delta); },

  clear() { write(0); },

  /**
   * Reconcile the cached count with the server: count = Σ qty across cart
   * lines. Call only when authenticated — GET /cart 401s for guests and the
   * api interceptor would bounce them to /login.
   */
  async refresh(): Promise<number> {
    try {
      const res = await api.get("/cart");
      const items = (res.data?.data?.items ?? []) as Array<{ qty?: number }>;
      const total = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
      write(total);
      return total;
    } catch {
      return read();
    }
  },

  /** Subscribe to count changes (same-tab + cross-tab). */
  subscribe(listener: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const onLocal = () => listener();
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) listener(); };
    window.addEventListener(EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  },
};
