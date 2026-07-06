// Wishlist — a localStorage cache for instant UI (and guests), mirrored to a
// per-account server list when signed in. The server is authoritative: it prunes
// product ids whose product no longer exists (so a re-import can't leave a saved
// id pointing at a different product) and it syncs across devices. `hydrate()`
// reconciles the two on sign-in.
//
// Reads stay synchronous (localStorage) so the pages/badges don't need to change;
// writes update localStorage immediately AND fire a best-effort backend call.

import { api } from "@/lib/api";
import { storage, STORAGE_KEYS } from "@/lib/storage";

const KEY = "epey.wishlist.ids";
const EVENT = "epey:wishlist-changed";

// Only sync to the server when there's an access token — otherwise a guest's
// call would 401 and the api interceptor would bounce them to /login.
const signedIn = () => !!storage.get(STORAGE_KEYS.ACCESS);
const syncAdd    = (id: number) => { if (signedIn()) api.post("/wishlist", { product_id: id }).catch(() => {}); };
const syncRemove = (id: number) => { if (signedIn()) api.delete(`/wishlist/${id}`).catch(() => {}); };
const syncClear  = ()           => { if (signedIn()) api.delete("/wishlist").catch(() => {}); };

function readIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number" && Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function writeIds(ids: number[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // localStorage can throw in private mode / over quota — fail silently.
  }
}

export const wishlist = {
  ids: readIds,

  has(id: number): boolean {
    return readIds().includes(id);
  },

  add(id: number) {
    const ids = readIds();
    if (!ids.includes(id)) { writeIds([id, ...ids]); syncAdd(id); }
  },

  remove(id: number) {
    writeIds(readIds().filter((n) => n !== id));
    syncRemove(id);
  },

  /** Toggle and return the new state. */
  toggle(id: number): boolean {
    const ids = readIds();
    if (ids.includes(id)) {
      writeIds(ids.filter((n) => n !== id));
      syncRemove(id);
      return false;
    }
    writeIds([id, ...ids]);
    syncAdd(id);
    return true;
  },

  clear() {
    writeIds([]);
    syncClear();
  },

  /** Drop the local cache WITHOUT touching the server (used on logout so the next
   *  user on a shared device doesn't inherit these favourites; the server keeps them). */
  resetLocal() {
    writeIds([]);
  },

  /** Reconcile local ↔ server on sign-in: upload any local (guest) favourites —
   *  the POST rejects dead product ids — then adopt the server's pruned, live list.
   *  Best-effort: offline / failure keeps the local cache untouched. */
  async hydrate(): Promise<void> {
    if (!signedIn() || typeof window === "undefined") return;
    try {
      const local = readIds();
      // Push local favourites first (idempotent; a deleted product 404s and is skipped).
      await Promise.all(local.map((id) => api.post("/wishlist", { product_id: id }).catch(() => {})));
      const r = await api.get("/wishlist");
      const serverIds = ((r.data.data?.ids ?? []) as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n));
      writeIds(serverIds); // authoritative: live products only, dead/reassigned ids pruned
    } catch {
      // offline or transient — keep whatever is already cached locally
    }
  },

  /** Subscribe to wishlist changes (same-tab + cross-tab via 'storage' event). */
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
