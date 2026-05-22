# Epey — Push Notifications: Status

**Last updated:** 2026-05-13
**Scope:** ONLY push notifications inside the APK (Android first, iOS deferred). Per CLAUDE.md this is the client's main requirement; nothing else changed.

---

## Status at a glance

| # | Item | Status | Owner |
|---|---|---|---|
| 1 | Backend FCM service (single env var, project_id from JSON) | DONE | me |
| 2 | NotificationService `sendTyped` + `sendTypedToRole` | DONE | me |
| 3 | Backend event triggers wired (orders, payments, withdrawals, tokens) | DONE | me |
| 4 | Frontend foreground toast + tap deep-link handlers | DONE | me |
| 5 | Handlers mounted in both `(app)/layout.tsx` | DONE | me |
| 6 | README updated (assume-zero Firebase checklist + Gradle steps) | DONE | me |
| 7 | Firebase project + service-account JSON | PENDING | **you** |
| 8 | `cap:add:android` in both apps + `google-services.json` + Gradle plugin | PENDING | **you** |
| 9 | `npx tsc --noEmit` clean in both apps | PENDING | **you** |
| 10 | End-to-end test on real Android (foreground/background/terminated) | PENDING | **you** |

---

## What shipped (code-side)

### Backend
- [backend/app/Services/FirebaseService.php](backend/app/Services/FirebaseService.php) — single env `firebase.credentials` (path to service-account JSON, relative or absolute). Project ID is read from the JSON's `project_id` field, so no separate var.
- [backend/.env](backend/.env) — replaced `firebase.projectId` + `firebase.serviceAccountPath` with one `firebase.credentials =`.
- [backend/app/Services/NotificationService.php](backend/app/Services/NotificationService.php) — added `sendTyped(userId, type, entityId, route, title, body)` + `sendTypedToRole(role, …)`. Payload shape sent to FCM `data`: `{ type, entity_id, route }`.
- [backend/app/Controllers/Api/OrderController.php](backend/app/Controllers/Api/OrderController.php) — `place` notifies customer + vendor + all admins; `setStatus` notifies customer.
- [backend/app/Controllers/Api/PaymentController.php](backend/app/Controllers/Api/PaymentController.php) — Razorpay `verify`, manual `submit` (→ admins), and Razorpay webhook all push.
- [backend/app/Controllers/Api/AdminPaymentController.php](backend/app/Controllers/Api/AdminPaymentController.php) — `approve` / `reject` push the customer (route `/wallet`).
- [backend/app/Controllers/Api/WithdrawalController.php](backend/app/Controllers/Api/WithdrawalController.php) — `create` → admins, `approve` / `reject` → requester.
- [backend/app/Controllers/Api/TokenController.php](backend/app/Controllers/Api/TokenController.php) — `distribute` and `adminProcess` push the recipient.
- All push calls wrapped in `try/catch` so a push failure never breaks the user action.

### Frontend (identical changes in both apps)
- [customer-app/lib/push.ts](customer-app/lib/push.ts) + [staff-app/lib/push.ts](staff-app/lib/push.ts) — added `initPushHandlers(navigate)`:
  - foreground push → `sonner` toast (no system tray, by design),
  - tap → `navigate(data.route ?? "/notifications")`.
  - Idempotent (won't double-install listeners).
- [customer-app/app/(app)/layout.tsx](customer-app/app/(app)/layout.tsx) + [staff-app/app/(app)/layout.tsx](staff-app/app/(app)/layout.tsx) — call `initPushHandlers((r) => router.push(r))` once on mount.

### Docs
- [README.md](README.md) — full Firebase setup checklist (assume zero), single-var env, Gradle plugin instructions for the Android scaffold, auto-push event matrix.

---

## Decisions in force

### Event matrix (implemented)

| Event | Push? | Target | Route in payload |
|---|---|---|---|
| Order created | Yes | Customer + vendor + all admins | `/orders` |
| Order status updated | Yes | Customer | `/orders` |
| Razorpay payment verified | Yes | Customer | `/wallet` |
| Razorpay webhook payment captured | Yes | Customer | `/wallet` |
| Manual payment submitted | Yes | All admins | `/payments` |
| Manual payment approved | Yes | Customer | `/wallet` |
| Manual payment rejected | Yes | Customer | `/wallet` |
| Withdrawal requested | Yes | All admins | `/withdrawals` |
| Withdrawal approved / rejected | Yes | Requester | `/wallet` |
| Token distributed / request approved | Yes | Recipient | `/wallet` |
| Admin broadcast (`POST /notifications/send`) | Yes | Selected user or role | (caller-supplied `data`) |

Routes deliberately point to existing list pages (decision per Clarification 2) — no `[id]` detail pages were created. CLAUDE.md says "do NOT add more and more features."

### Push payload (FCM `data`)

```json
{ "type": "order_created", "entity_id": "123", "route": "/orders" }
```

Tap handler reads `data.route` and navigates there; missing → `/notifications`.

### Backend env

```
firebase.credentials = writable/firebase-service-account.json
```

Single var. Path may be relative (resolved from backend root) or absolute. Project ID is read from the JSON itself.

---

## Out of scope (explicit)

- iOS APNs (deferred — needs Mac + Apple Dev account).
- Web push (browser Notification API / VAPID / service worker).
- Rich notifications, custom channels / sounds.
- Notification preferences UI (per-category opt-out).
- Scheduled / recurring pushes, delivery analytics.
- Low-wallet-balance alerts.
- Dedicated `[id]` detail pages for orders, payments, withdrawals.

---

## What's left for you

### A. Firebase project (one-time)
1. Create project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable Cloud Messaging.
3. Add Android app `com.epey.customer` → download `google-services.json` (#1).
4. Add Android app `com.epey.staff` → download `google-services.json` (#2).
5. Add SHA-1 debug fingerprint for each app:
   ```powershell
   keytool -list -v -alias androiddebugkey -storepass android -keystore $env:USERPROFILE\.android\debug.keystore
   ```
6. Project settings → Service accounts → Generate new private key → save JSON.
7. Place service-account JSON at `backend/writable/firebase-service-account.json`.
8. Set `firebase.credentials = writable/firebase-service-account.json` in `backend/.env`.

### B. Android scaffold (each app)
```powershell
cd customer-app; npm run cap:add:android
cd staff-app;    npm run cap:add:android
```

For each app after scaffolding:
- Copy matching `google-services.json` to `android/app/google-services.json`.
- `android/build.gradle` → inside `buildscript { dependencies { … } }` add:
  ```groovy
  classpath 'com.google.gms:google-services:4.4.2'
  ```
- `android/app/build.gradle` → at the bottom add:
  ```groovy
  apply plugin: 'com.google.gms.google-services'
  ```
- `npm run cap:sync`.
- Open in Android Studio, build APK, install on a real device.

### C. Verify (in this order)
1. `npx tsc --noEmit` in both apps — paste any errors.
2. App boots, login completes, `device_tokens` row appears for the user.
3. Backend admin call `POST /api/v1/notifications/send` with `{ user_id, title, body, data: { route: "/wallet" } }`:
   - **Foreground** (app open) → toast appears.
   - **Background** (app behind) → tray notification.
   - **Terminated** (app force-closed) → tray notification.
   - Tap → app opens at the route from payload (or `/notifications`).
4. Place a real order, approve a payment, etc. — confirm the right user gets the push from the matrix above.

---

## If something breaks
Paste the error verbatim and I'll fix it directly:
- TypeScript errors from `npx tsc --noEmit`
- Gradle / Android Studio build errors
- Capacitor sync errors
- FCM 4xx/5xx in `backend/writable/logs/log-*.php`
- Device-side: `adb logcat | grep -i fcm` output
