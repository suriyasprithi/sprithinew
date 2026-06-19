# Referral deferred deep linking — build & verify

Referral code = the referrer's **10-digit mobile number**. Link format:
`https://app.sprithi.com/ref/{mobile}`.

## How it flows

1. **Share** — Refer page generates `https://app.sprithi.com/ref/{mobile}`.
2. **Tap (app installed)** — verified **App Links** open the app → `App.appUrlOpen`
   fires → code stored → routed to `/register`.
3. **Tap (not installed)** — browser loads `GET /ref/{code}` (CI4 `RefController`):
   - Android → Play Store `…&referrer=ref%3D{code}`
   - Desktop → `/customer/register/?ref={code}`
4. **After Play install** — first launch reads the **Install Referrer** (native
   plugin), parses `ref={code}`, stores it.
5. **Register** — code auto-filled **read-only**, shows `Referred By: {Name}` +
   `Referral Code`. OTP is mandatory. Reward fires server-side only after the
   account is created; the pending code is then cleared.

Server security (already wired in `AuthController::register`): self-referral
ignored, invalid/expired codes ignored, one reward per account (mobile unique
per role), audit line logged.

## Server (already done, deploy backend)

- `GET /ref/{code}` and `GET /.well-known/assetlinks.json` are CI4 routes.
- **assetlinks.json** lists the signing-cert SHA-256s in `Controllers/WellKnown.php`.
  It currently has the **upload key**. For Play installs you MUST add the
  **Play App Signing key** SHA-256 (Play Console → App integrity → App signing
  key certificate) or App Links won't verify. Confirm it serves:
  `curl https://app.sprithi.com/.well-known/assetlinks.json`

## Android build (Codespaces)

```bash
cd customer-app
npm install                      # picks up the local install-referrer plugin
echo "NEXT_PUBLIC_API_URL=https://app.sprithi.com" > .env.production.local
CAPACITOR_BUILD=1 npm run build
npx cap add android              # (first run; regenerates android/)
# compileSdk 36 (see project_customer_apk_build memory)
sed -i -E 's/compileSdkVersion *= *[0-9]+/compileSdkVersion = 36/' android/variables.gradle
cp firebase/google-services.json android/app/google-services.json   # push wiring
npx cap sync android
bash scripts/patch-applinks.sh   # adds the /ref/ App Links intent-filter
cd android && ./gradlew bundleRelease   # or assembleRelease for a test APK
```

Then sign + upload (same `~/sprithi-release.jks`; see project memory).

> `scripts/build-apk.sh` already runs `patch-applinks.sh` for the debug flow.
> For the release flow run it manually after `cap sync` (shown above).

## Verify

- **App Links**: `adb shell am start -a android.intent.action.VIEW -d "https://app.sprithi.com/ref/9876543210"` → app opens on `/register` with the code locked.
- **Install Referrer** (needs a real Play install): install from a Play URL with
  `&referrer=ref%3D9876543210`, open the app, confirm the code is on `/register`.
  (Play **internal testing** install also delivers the referrer.)
- **Deferred**: only works once the app is **live on Play** with assetlinks
  containing the **Play App Signing** fingerprint.
