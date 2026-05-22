# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev              # Next dev server (webpack, WASI Tailwind oxide forced)
npm run build            # Static export → out/  (required before any cap:* command)
npm run lint             # eslint (flat config, extends eslint-config-next)
npm run cap:add:android  # Build + add android platform (run once)
npm run cap:sync         # Build + copy web assets into native projects
npm run cap:run:android  # Build + launch on connected Android device/emulator
npm run cap:open:android # Open the android/ project in Android Studio
```

`dev` and `build` set `NAPI_RS_FORCE_WASI=1` because the native Tailwind 4 oxide binary doesn't load on this Windows setup — the WASI fallback (`@tailwindcss/oxide-wasm32-wasi`) is an optional dep. Don't remove the env var unless you've replaced the toolchain.

There is no test runner configured.

## Architecture

### Web-as-mobile-app, not a hybrid SPA
This is a Next.js 16 + React 19 app that is statically exported (`next.config.ts` → `output: "export"`, `trailingSlash: true`, `images.unoptimized: true`) into `out/`, which Capacitor 8 (`capacitor.config.ts`: `webDir: "out"`, `appId: com.epey.customer`) packages as the Android/iOS APK. The **core product requirement is push notifications working inside the APK** (see parent CLAUDE.md) — design changes around `lib/push.ts` and the device-register flow with that in mind. Every page must work in static-export mode (no `getServerSideProps`, no route handlers expecting a running server, no server-only APIs at runtime).

### Routing
- `app/` uses the App Router. Public routes live at the root (`login`, `register`, `forgot-password`, `home`, `shop-public`, `vendors-public`, `coming-soon`, `after-register`).
- `app/(app)/` is a route group whose `layout.tsx` wraps everything in `<AuthGuard>` plus `<SideNav>` + `<BottomNav>`. Any authenticated screen (dashboard, wallet, cart, orders, profile, etc.) belongs in this group; placing it at the root bypasses the auth gate.
- `GuestGuard` (in `components/auth-guard.tsx`) is the inverse — use it on login/register pages so signed-in users get redirected to `/dashboard`.

### Auth and token lifecycle
Three pieces work together; changing one usually means changing the others:

1. **`stores/auth.ts`** — zustand store exposing `user`, `isHydrated`, `login`, `register`, `logout`, `hydrate`. `hydrate()` is called once on mount by `<AuthInit>` (mounted in the root `app/layout.tsx`) and decides whether the user is logged in by calling `/auth/me` with whatever token is in storage.
2. **`lib/storage.ts`** — sync `storage.get/set/remove` API backed by `localStorage`. On native (Capacitor), writes also go to `@capacitor/preferences` (write-through), and `hydrateStorage()` eagerly mirrors Preferences → localStorage on first load. This matters because Android backup/restore can wipe localStorage but Preferences survives. Call `hydrateStorage()` before reading tokens on native — `<AuthInit>` already does this.
3. **`lib/api.ts`** — axios instance at `${NEXT_PUBLIC_API_URL}/api/v1`. Request interceptor injects `Authorization: Bearer …`. Response interceptor handles 401 with a single-flight refresh: queues concurrent failures, posts to `/auth/refresh`, replays the original request, and on failure clears tokens and redirects to `/login`. The `/auth/login`, `/auth/refresh`, and `/auth/register` endpoints are exempted from the refresh loop to avoid recursion.

### API envelope
The backend returns `{ success, message, data, errors? }` (`ApiEnvelope<T>` in `lib/api.ts`). Always read payloads as `res.data.data`, not `res.data`. `apiErrorMessage(err)` is the canonical way to surface error strings to the UI (via `sonner` toasts).

### Push notifications (`lib/push.ts`)
`registerDeviceToken()` is invoked from `auth.login`, `auth.register`, and `auth.hydrate` (best-effort — failures must never block auth). On native it dynamically imports `@capacitor/push-notifications`, requests permission, waits up to 8s for the `registration` event, then POSTs `{ token, platform: "android"|"ios" }` to `/devices/register`. On web it generates a stable stub token in localStorage and registers it as `platform: "web"` so the backend has a consistent identity for the same browser session. `unregisterDeviceToken()` is called on logout.

### State, styling, forms
- **Zustand** for client state (currently only the auth store). No persistence middleware — tokens persist via `lib/storage.ts`, the user object is rehydrated from `/auth/me`.
- **shadcn/ui** (`components.json`: style `base-nova`, neutral base color, lucide icons) → generated into `components/ui/`. Path aliases in `tsconfig.json`: `@/*` resolves to the project root.
- **Tailwind v4** via `@tailwindcss/postcss` (no `tailwind.config`; tokens live in `app/globals.css`). `tw-animate-css` and `tailwindcss-animate` are both present.
- **next-themes** for dark mode (`<ThemeProvider>` in root layout).
- **react-hook-form + zod** with `@hookform/resolvers` for forms.

### Environment
- `NEXT_PUBLIC_API_URL` (default `http://localhost:8080`) → backend base. The app calls `${API_URL}/api/v1/...`.
- For native testing against a LAN dev server, uncomment the `server.url` block in `capacitor.config.ts` (note `allowMixedContent: false` is set, so cleartext requires that flag in the server config).

## Conventions that aren't obvious from the code

- Anything that touches `window`, `localStorage`, or `Capacitor.*` must be in a `"use client"` file or guarded with `typeof window !== "undefined"` — static export still runs the build-time render.
- Dynamic-import the Capacitor plugins (`@capacitor/push-notifications`, `@capacitor/preferences`) rather than top-level imports, so the web bundle stays free of native-only code paths.
- Never throw from `registerDeviceToken` / `unregisterDeviceToken` — login and logout flows assume they're fire-and-forget.
