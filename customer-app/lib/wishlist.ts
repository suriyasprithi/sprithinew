// Tiny client-side wishlist — localStorage only, no backend.
// Stores the user's "liked" product IDs so the wishlist page and the heart
// button on product cards stay in sync across reloads / tabs.
//
// If you ever want cross-device sync, replace these reads/writes with API
// calls; the surface area stays the same.

const KEY = "epey.wishlist.ids";
const EVENT = "epey:wishlist-changed";

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
    if (!ids.includes(id)) writeIds([id, ...ids]);
  },

  remove(id: number) {
    writeIds(readIds().filter((n) => n !== id));
  },

  /** Toggle and return the new state. */
  toggle(id: number): boolean {
    const ids = readIds();
    if (ids.includes(id)) {
      writeIds(ids.filter((n) => n !== id));
      return false;
    }
    writeIds([id, ...ids]);
    return true;
  },

  clear() {
    writeIds([]);
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
