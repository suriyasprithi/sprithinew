#!/usr/bin/env bash
# Build a debug APK for staff-app inside Codespaces.
#
# Usage:
#   bash staff-app/scripts/build-apk.sh                                # uses existing .env.production.local
#   bash staff-app/scripts/build-apk.sh https://my-tunnel.trycloudflare.com
#
# The optional URL argument:
#   1. Writes NEXT_PUBLIC_API_URL=<url> into staff-app/.env.production.local
#   2. Verifies the tunnel responds (curl the API) BEFORE the long Gradle build
#   3. Aborts if the tunnel is unreachable, with a clear message
set -euo pipefail

cd "$(dirname "$0")/.."   # → staff-app/

APP_NAME="staff-app"
echo "==> $APP_NAME → Android debug APK"

if [ "${1:-}" != "" ]; then
  RAW_URL="$1"
  URL="${RAW_URL%/}"
  echo "==> Backend URL passed in: $URL"
  echo "==> Verifying tunnel is reachable (timeout 10s)…"
  HTTP_CODE=$(curl -sS -o /tmp/tunnel-probe -w "%{http_code}" --max-time 10 "$URL/api/v1/auth/me" || echo "000")
  echo "    HTTP $HTTP_CODE  (body: $(head -c 200 /tmp/tunnel-probe 2>/dev/null || true))"
  case "$HTTP_CODE" in
    2*|4*)
      echo "    ✓ Tunnel responds — proceeding with build."
      ;;
    000|5*)
      echo ""
      echo "    ✗ Tunnel is UNREACHABLE (HTTP $HTTP_CODE)."
      echo "      Common causes:"
      echo "        - cloudflared isn't running on your Windows machine"
      echo "        - cloudflared --url points to the wrong port (backend listens on :8080 per backend/.env)"
      echo "        - Tunnel URL has expired (trycloudflare quick tunnels rotate on restart)"
      echo ""
      echo "      Fix the tunnel, then re-run with the new URL."
      exit 1
      ;;
    *)
      echo "    ⚠ Unexpected HTTP $HTTP_CODE — proceeding anyway, but expect the APK to fail."
      ;;
  esac
  echo "NEXT_PUBLIC_API_URL=$URL" > .env.production.local
  echo "==> Wrote .env.production.local:"
  sed 's/^/    /' .env.production.local
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME is not set. Did the devcontainer postCreate finish?" >&2
  exit 1
fi
if ! command -v java >/dev/null; then
  echo "ERROR: java not on PATH. Expected JDK 21 from devcontainer feature." >&2
  exit 1
fi

if [ ! -s ".env.production.local" ] || ! grep -q "^NEXT_PUBLIC_API_URL=https" .env.production.local; then
  echo ""
  echo "⚠ WARNING: staff-app/.env.production.local has no NEXT_PUBLIC_API_URL set."
  echo "  To bake a backend URL in: re-run with the URL as an argument:"
  echo "      bash staff-app/scripts/build-apk.sh https://your-tunnel.trycloudflare.com"
  echo ""
fi

if [ ! -d "node_modules" ]; then
  echo "==> Installing npm dependencies…"
  npm install --no-audit --no-fund
fi

echo "==> Building Next.js (static export, Capacitor mode)…"
CAPACITOR_BUILD=1 npm run build

if [ ! -d "android" ]; then
  echo "==> First run: adding Android platform via Capacitor…"
  npx cap add android
fi

# Wire Firebase Android config. We can't track android/app/google-services.json
# directly (the whole android/ folder is gitignored), so the source of truth
# lives in staff-app/firebase/ and we copy it in each build.
if [ -f "firebase/google-services.json" ]; then
  echo "==> Copying firebase/google-services.json → android/app/"
  cp firebase/google-services.json android/app/google-services.json
else
  echo ""
  echo "    ⚠ firebase/google-services.json not found. Push notifications will"
  echo "      crash the APK on permission grant. To fix:"
  echo "      1. Firebase Console → Add Android app with package com.epey.staff"
  echo "      2. Download google-services.json"
  echo "      3. Save to staff-app/firebase/google-services.json"
  echo "      4. Re-run this build"
  echo ""
fi

# Generate launcher icons + splash from resources/icon.png (1024x1024 PNG).
# Only runs if a source icon is present in the repo.
if [ -f "resources/icon.png" ]; then
  if [ ! -d "node_modules/@capacitor/assets" ]; then
    echo "==> Installing @capacitor/assets for icon generation…"
    npm install --no-audit --no-fund -D @capacitor/assets
  fi
  echo "==> Generating Android launcher icons from resources/icon.png…"
  npx capacitor-assets generate --android --iconBackgroundColor "#FFFFFF" || \
    echo "    ⚠ icon generation failed — continuing with previous icons"
else
  echo "==> No resources/icon.png found — keeping default icons."
fi

echo "==> cap sync android…"
npx cap sync android

echo "==> Gradle assembleDebug…"
cd android
chmod +x gradlew
./gradlew --no-daemon assembleDebug

APK="$PWD/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo "ERROR: APK not found at expected path: $APK" >&2
  exit 1
fi

SIZE=$(du -h "$APK" | cut -f1)
echo ""
echo "===================================================================="
echo "  $APP_NAME debug APK built successfully"
echo "  Path:    $APK"
echo "  Size:    $SIZE"
echo "  API URL: $(grep '^NEXT_PUBLIC_API_URL' ../.env.production.local 2>/dev/null | head -1 || echo '(unset — will use localhost:8080)')"
echo "===================================================================="
echo ""
echo "  Next: Right-click the APK in the file explorer → Download"
echo "        Uninstall the old app on your phone first, then install the new one."
