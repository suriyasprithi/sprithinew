"use client";

/**
 * Where to send the user when their session is unauthenticated.
 *
 * Per-role web builds (basePath=/admin /vendor /state /district /taluk /driver)
 *   → cross-role URL "/admin/login/" works because Apache serves all of them
 *     under the same domain on app.sprithi.com.
 *
 * Capacitor APK builds (CAPACITOR_BUILD=1 → basePath="")
 *   → there is no /admin/login/ path in the asset bundle. window.location.href
 *     would either show a blank screen or stay stuck on the splash. We use the
 *     in-app /login route via the Next.js router instead.
 */
/**
 * Login URL for a full-page redirect after logout (window.location).
 * Admin uses the hidden /admin/control/; other per-role web builds use the
 * unified /admin/login/; the Capacitor APK (basePath="") uses the in-app route.
 */
// The admin APK (ADMIN_BUILD=1, basePath="") opens to the hidden /control login
// instead of the staff /login role-selector.
const IS_ADMIN_APK = (process.env.NEXT_PUBLIC_ADMIN_BUILD ?? "") === "1";

export function loginUrl(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (basePath === "") return IS_ADMIN_APK ? "/control/" : "/login/";
  if (basePath === "/admin") return "/admin/control/";
  return "/admin/login/";
}

export function goToLogin(router?: { replace: (href: string) => void }): void {
  if (typeof window === "undefined") return;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (basePath === "") {
    // Capacitor APK: navigate within the SPA (admin → /control, staff → /login)
    const dest = IS_ADMIN_APK ? "/control" : "/login";
    if (router) router.replace(dest);
    else window.location.assign(dest + "/");
    return;
  }
  // Web per-role build: unified login lives at /admin/login/ on the same origin
  window.location.href = "/admin/login/";
}
