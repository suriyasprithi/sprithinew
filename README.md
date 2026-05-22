# Epey

Multi-role wallet / token system → **Web + Android APK** (iOS deferred).

## Stack

| Layer | Tech |
|---|---|
| Backend | CodeIgniter 4 (PHP 8.2) + MySQL via mysqli + JWT auth |
| Frontend | Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui |
| Mobile  | Capacitor (Android) |
| Push    | Firebase Cloud Messaging (FCM v1) |
| Payments| Razorpay + Manual (admin toggle) |
| Hosting | Hostinger Cloud (planned) |

## Layout

```
epey/
├── backend/         CodeIgniter 4 REST API
├── customer-app/    Next.js → Customer APK + Web
├── staff-app/       Next.js → Staff APK + Web (vendor / district / taluk / vmanager / admin)
├── uploaded/        original PHP views (reference only)
├── composer.phar    local Composer
└── README.md
```

## Quick start (3 terminals)

```powershell
# 1. Start MySQL (XAMPP — should auto-start with phpMyAdmin)

# 2. Backend (port 8080)
cd c:\xampp\htdocs\epey\backend
C:\xampp\php\php.exe spark serve --port 8080

# 3. Customer app (port 3000)
cd c:\xampp\htdocs\epey\customer-app
npm run dev

# 4. Staff app (port 3001)
cd c:\xampp\htdocs\epey\staff-app
npm run dev -- --port 3001
```

## Test users (already seeded)

| Mobile | Password | Role |
|---|---|---|
| 9999000001 | secret123 | customer |
| 9999000010 | secret123 | vendor |
| 9999000011 | secret123 | district |
| 9999000012 | secret123 | taluk |
| 9999000013 | secret123 | vmanager |
| 9999000014 | secret123 | admin |

Re-run seeder: `php spark db:seed StaffSeeder` (idempotent).

## API summary (`/api/v1`)

### Public
- `POST /auth/register` — customer self-signup
- `POST /auth/login` — body: `{ mobile_number, password, role }`
- `POST /auth/refresh` — `{ refresh_token }`
- `POST /webhooks/razorpay` — Razorpay payment webhook

### Authed (`Authorization: Bearer …`)
- `GET  /auth/me` · `POST /auth/logout`
- `GET  /profile` · `PATCH /profile` (customer extended fields: address, KYC, bank, UPI…)
- `POST /devices/register` — `{ token, platform: "android"|"ios"|"web" }`
- `POST /devices/unregister` — `{ token }`
- `GET  /notifications` · `PATCH /notifications/{id}/read`
- `POST /notifications/send` — admin only
- `GET  /payments/methods` — only enabled gateways
- `POST /payments/razorpay/order` · `POST /payments/razorpay/verify`
- `POST /payments/manual` (multipart: amount, txn_id, screenshot)
- `GET  /payments/mine` — user's payment history

### Admin only
- `GET  /admin/payments/pending`
- `POST /admin/payments/{id}/approve` · `POST /admin/payments/{id}/reject`
- `GET  /admin/payment-settings` · `PATCH /admin/payment-settings`

Response envelope: `{ success, message, data, errors? }`

## Phase status

| Phase | Status |
|---|---|
| 0. Setup | ✅ |
| 1. Auth foundation (JWT, login/register) | ✅ |
| 2. Customer app shell + profile | ✅ |
| 3. Staff app shell + role-based menus | ✅ |
| 4. Push notifications (backend + Firebase service + registration) | ✅ (needs Firebase keys) |
| 6. Payments (Razorpay + Manual + admin settings) | ✅ (needs Razorpay keys) |
| 7. APK build (Capacitor configured) | ⚠️ (needs Android Studio) |
| 8. Hostinger deploy | ⏳ (needs your credentials) |
| 9. iOS | ⏳ (deferred — needs Mac + Apple Dev account) |

## What still needs YOU

### 1. Firebase (for push)
Assume zero — full setup checklist:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Cloud Messaging** in the project (it's on by default; just confirm under Project settings → Cloud Messaging).
3. Add Android app for package `com.epey.customer` → download `google-services.json` (#1).
4. Add Android app for package `com.epey.staff` → download `google-services.json` (#2).
5. Add SHA-1 debug fingerprints under each Android app's settings. Get yours with:
   ```powershell
   keytool -list -v -alias androiddebugkey -storepass android -keystore $env:USERPROFILE\.android\debug.keystore
   ```
6. **Project settings → Service accounts → Generate new private key** → download the service-account JSON.
7. Save it to `backend/writable/firebase-service-account.json`.
8. Edit `backend/.env`:
   ```
   firebase.credentials = writable/firebase-service-account.json
   ```
   The Firebase project ID is read from the JSON itself — no separate env var needed. Absolute paths are also accepted.
9. Verify backend wiring: `POST /api/v1/notifications/send` (admin token, body `{ "user_id": <id>, "title": "Test", "body": "hi" }`). On failure see `backend/writable/logs/`.

Until `firebase.credentials` is set, push send is a no-op (a row is still recorded in `notifications`, but nothing reaches FCM — by design, so dev environments don't need Firebase).

**Auto-push events** (already wired in the backend):

| Event | Push? | Target |
|---|---|---|
| Order created | Yes | Customer + vendor + all admins |
| Order status updated | Yes | Customer |
| Payment success (Razorpay verify, webhook, manual approve) | Yes | Customer |
| Payment rejected | Yes | Customer |
| Manual payment submitted | Yes | All admins |
| Withdrawal requested | Yes | All admins |
| Withdrawal approved / rejected | Yes | Requester |
| Token distributed / request approved | Yes | Recipient |
| Admin broadcast (`POST /notifications/send`) | Yes | Selected user or role |

Push payload (FCM `data`): `{ type, entity_id, route }`. The mobile tap handler reads `data.route` and navigates there (fallback `/notifications`).

### 2. Razorpay
1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com), complete KYC for live keys
2. Settings → API Keys → Generate Test Keys (use these first)
3. In the Staff app: log in as admin → **Settings** → enable Razorpay → paste Key ID + Secret + Webhook secret → Save
4. (Optional) Add webhook URL: `https://your-domain.com/api/v1/webhooks/razorpay`, event `payment.captured`

Same flow for Manual payment: enable, fill UPI / GPay / bank fields → Save.

### 3. Android Studio + APK
Install:
- Android Studio (includes JDK + SDK): https://developer.android.com/studio
- During setup, accept SDK licenses

Build the APKs:
```powershell
# Customer APK
cd c:\xampp\htdocs\epey\customer-app
npm run cap:add:android       # one-time: scaffolds android/ folder
# Drop the matching google-services.json into android/app/ here
npm run cap:sync              # rebuild + copy web assets to android/
npm run cap:open:android      # opens Android Studio → Build → Build APK

# Staff APK — same commands in c:\xampp\htdocs\epey\staff-app
```

After `cap:add:android`, for each app **add the Firebase Gradle plugin** so push works:

1. `android/build.gradle` (project-level) — add inside `dependencies` of `buildscript`:
   ```groovy
   classpath 'com.google.gms:google-services:4.4.2'
   ```
2. `android/app/build.gradle` (app-level) — add at the very bottom:
   ```groovy
   apply plugin: 'com.google.gms.google-services'
   ```
3. Copy the matching `google-services.json` to `android/app/google-services.json`.
4. `npm run cap:sync` again, then build.

Test push in three states: app foreground (toast), app background (system tray), app force-closed (system tray on tap → opens app at the deep link).

Result: `android/app/build/outputs/apk/debug/app-debug.apk` (install on phone, enable "Install from unknown sources").

For release/Play Store: generate a signing keystore, configure `android/app/build.gradle`, build signed APK/AAB.

### 4. Hostinger deploy (when ready)
- Backend: FTP/Git push `backend/` (set document root to `backend/public`), import DB via phpMyAdmin, set `.env` on server.
- Frontend: `npm run build` in each app → upload `out/` to `customer.yourdomain.com` and `staff.yourdomain.com`.
- Update `NEXT_PUBLIC_API_URL` in each app's `.env.local` to the live backend URL **before** building.

## Known platform quirks

- **Windows Application Control blocks Next.js + Tailwind native bindings.** Workarounds in place: `cross-env NAPI_RS_FORCE_WASI=1` + manually-extracted `@tailwindcss/oxide-wasm32-wasi`. Don't run `npm install` with `--prune` or it'll wipe these.
- WASM SWC swallows TypeScript errors with `"invalid type: unit value, expected usize"`. When you hit it, run `npx tsc --noEmit` in that app to see the real errors.

## Useful commands

```powershell
# Backend
php spark migrate                 # run new migrations
php spark migrate:rollback        # undo last batch
php spark db:seed StaffSeeder     # seed staff users
php spark db:table users          # inspect a table

# Frontend (each app)
npm run dev                       # dev server
npm run build                     # static export to out/
npx tsc --noEmit                  # check TS without building
```
