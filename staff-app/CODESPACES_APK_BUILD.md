# SPRITHI Staff + Admin APK / AAB — build from scratch in Codespaces

One codebase → **two apps** (different appId, install side-by-side):

| App | appId | Opens to | Push config (FCM) | Build env |
|-----|-------|----------|-------------------|-----------|
| **Staff** | `com.epey.staff` | `/login` | `firebase/google-services.json` | `CAPACITOR_BUILD=1` |
| **Admin** | `com.epey.admin` | `/control` | `firebase-admin/google-services.json` | `CAPACITOR_BUILD=1 ADMIN_BUILD=1` |

`android/` is regenerated per variant (the appId is baked at `cap add`), so build
**one fully, then `rm -rf android` and build the other**.

**Prereqs** (Java 21 + Android SDK) and the **release keystore** are the same as the
customer guide — see [`../customer-app/CODESPACES_APK_BUILD.md`](../customer-app/CODESPACES_APK_BUILD.md)
§0. The keystore `customer-app/newww/sprithi-release.jks` (alias `sprithi`) signs all
three apps.

---

## A. Staff APK  (`com.epey.staff`)

```bash
cd /workspaces/sprithinew/staff-app

# 1. API URL — baked at build, gitignored, so set it here
printf 'NEXT_PUBLIC_API_URL=https://app.sprithi.com\n' > .env.production

# 2. web (empty basePath) + fresh android with the STAFF appId
rm -rf android out .next
CAPACITOR_BUILD=1 npm run build
npx cap add android
```
Push file for the **common steps** below = `firebase/google-services.json`.

---

## B. Admin APK  (`com.epey.admin`)  — after the staff build is done

```bash
cd /workspaces/sprithinew/staff-app
printf 'NEXT_PUBLIC_API_URL=https://app.sprithi.com\n' > .env.production

rm -rf android out .next
ADMIN_BUILD=1 CAPACITOR_BUILD=1 npm run build
ADMIN_BUILD=1 npx cap add android          # appId com.epey.admin
```
Push file for the **common steps** below = `firebase-admin/google-services.json`.

---

## Common steps  (run after each `cap add`, in `staff-app/`)

```bash
cd /workspaces/sprithinew/staff-app

# --- camera permission (QR scanner) — idempotent ---
grep -q 'android.permission.CAMERA' android/app/src/main/AndroidManifest.xml || \
  sed -i 's#<application#<uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n\n    <application#' android/app/src/main/AndroidManifest.xml

# --- push: copy the RIGHT google-services.json for this variant ---
cp firebase/google-services.json android/app/            # STAFF
# cp firebase-admin/google-services.json android/app/    # <-- use THIS line for the ADMIN build

# --- icons: launcher + splash + notification ---
npx @capacitor/assets generate --android
cp -r notification-res/drawable-* android/app/src/main/res/
grep -q 'default_notification_icon' android/app/src/main/AndroidManifest.xml || \
  sed -i 's#</application>#    <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_notification" />\n</application>#' android/app/src/main/AndroidManifest.xml

# --- version code (bump per Play release) ---
sed -i -E 's/versionCode[[:space:]]+[0-9]+/versionCode 5/' android/app/build.gradle

# --- signing (reuse the SPRITHI keystore) ---
read -rsp 'Keystore password: ' PW; echo
printf 'storeFile=../../../customer-app/newww/sprithi-release.jks\nstorePassword=%s\nkeyAlias=sprithi\nkeyPassword=%s\n' "$PW" "$PW" > android/keystore.properties
printf '\ndef ksP=new Properties()\ndef ksF=rootProject.file("keystore.properties")\nif(ksF.exists()){\n  ksF.withInputStream{ksP.load(it)}\n  android{\n    signingConfigs{release{storeFile file(ksP["storeFile"]);storePassword ksP["storePassword"];keyAlias ksP["keyAlias"];keyPassword ksP["keyPassword"]}}\n    buildTypes{release{signingConfig signingConfigs.release}}\n  }\n}\n' >> android/app/build.gradle

# --- build signed APK + AAB ---
cd android
./gradlew clean assembleRelease bundleRelease
ls -la app/build/outputs/apk/release/ app/build/outputs/bundle/release/
cd ..
```

Outputs — **rename before building the other variant** so they don't get overwritten:

```bash
cp android/app/build/outputs/apk/release/app-release.apk    sprithi-staff.apk   # or sprithi-admin.apk
cp android/app/build/outputs/bundle/release/app-release.aab  sprithi-staff.aab   # or sprithi-admin.aab
```

---

## Quick reference

- White screen → built without `CAPACITOR_BUILD=1`.
- Wrong app opens (login vs control) → `ADMIN_BUILD=1` not set for both `npm run build` **and** `cap add`.
- `ic_stat_notification not found` → the `cp -r notification-res/...` was skipped (`git pull` first so `notification-res/` exists).
- No push → wrong `google-services.json` (staff vs admin) or the google-services gradle plugin not applied (it auto-applies when the file is in `android/app/`).
- Re-run `git checkout -- staff-app/out` before `git pull` if a Codespace web build blocks the pull.
