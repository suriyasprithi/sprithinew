/**
 * In-memory stale-while-revalidate cache for the footer tabs (Cart, Orders,
 * Home…). Module-level so it survives client-side navigation: re-opening a tab
 * renders the last-seen data instantly while the page refreshes in the
 * background, so switching tabs no longer waits on the network round-trip.
 *
 * Cleared on login/logout so one account never sees another's data. Lost on a
 * full page reload (the first load just refetches — acceptable).
 */
const store = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return store.has(key) ? (store.get(key) as T) : undefined;
}

export function setCached<T>(key: string, value: T): void {
  store.set(key, value);
}

export function clearPageCache(): void {
  store.clear();
}
