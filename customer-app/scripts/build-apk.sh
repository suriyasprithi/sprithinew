#!/usr/bin/env bash
# Build a debug APK for customer-app inside Codespaces.
#
# Usage:
#   bash customer-app/scripts/build-apk.sh                                # uses existing .env.production.local
#   bash customer-app/scripts/build-apk.sh https://my-tunnel.trycloudflare.com
#
# The optional URL argument:
#   1. Writes NEXT_PUBLIC_API_URL=<url> into customer-app/.env.production.local
#   2. Verifies the tunnel responds (curl the API) BEFORE the long Gradle build
#   3. Aborts if the tunnel is unreachable, with a clear message
set -euo pipefail

cd "$(dirname "$0")/.."   # → customer-app/

APP_NAME="customer-app"
echo "==> $APP_NAME → Android debug APK"

# ---------------------------------------------------------------------------
# 0. (Optional) Bake the backend URL from $1 and verify it responds
# ---------------------------------------------------------------------------
if [ "${1:-}" != "" ]; then
  RAW_URL="$1"
  # Strip trailing slash
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

# ---------------------------------------------------------------------------
# 1. Sanity checks
# ---------------------------------------------------------------------------
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME is not set. Did the devcontainer postCreate finish?" >&2
  exit 1
fi
if ! command -v java >/dev/null; then
  echo "ERROR: java not on PATH. Expected JDK 21 from devcontainer feature." >&2
  exit 1
fi

# Warn if .env.production.local is empty or missing — APK will be useless without an API URL
if [ ! -s ".env.production.local" ] || ! grep -q "^NEXT_PUBLIC_API_URL=https" .env.production.local; then
  echo ""
  echo "⚠ WARNING: customer-app/.env.production.local has no NEXT_PUBLIC_API_URL set."
  echo "  The APK will fall back to http://localhost:8080 which won't work from a phone."
  echo "  To bake a backend URL in: re-run with the URL as an argument:"
  echo "      bash customer-app/scripts/build-apk.sh https://your-tunnel.trycloudflare.com"
  echo ""
fi

# ---------------------------------------------------------------------------
# 2. Install npm deps if missing
# ---------------------------------------------------------------------------
if [ ! -d "node_modules" ]; then
  echo "==> Installing npm dependencies…"
  npm install --no-audit --no-fund
fi

# ---------------------------------------------------------------------------
# 3. Next.js static export → out/
#    CAPACITOR_BUILD=1 strips basePath/assetPrefix so the APK loads from /
# ---------------------------------------------------------------------------
echo "==> Building Next.js (static export, Capacitor mode)…"
CAPACITOR_BUILD=1 npm run build

# ---------------------------------------------------------------------------
# 4. Add android platform on first run
# ---------------------------------------------------------------------------
if [ ! -d "android" ]; then
  echo "==> First run: adding Android platform via Capacitor…"
  npx cap add android
fi

# Wire Firebase Android config (same file works for both apps if both Android
# apps are registered in the same Firebase project). android/ is gitignored
# so the source of truth lives in customer-app/firebase/.
if [ -f "firebase/google-services.json" ]; then
  echo "==> Copying firebase/google-services.json → android/app/"
  cp firebase/google-services.json android/app/google-services.json
else
  echo ""
  echo "    ⚠ firebase/google-services.json not found. Push notifications will"
  echo "      crash the APK on permission grant. To fix:"
  echo "      1. Firebase Console → Add Android app with package com.epey.customer"
  echo "      2. Download google-services.json"
  echo "      3. Save to customer-app/firebase/google-services.json"
  echo "      4. Re-run this build"
  echo ""
fi

# ---------------------------------------------------------------------------
# 5. Copy web assets into native project
# ---------------------------------------------------------------------------
echo "==> cap sync android…"
npx cap sync android

# ---------------------------------------------------------------------------
# 6. Build debug APK
# ---------------------------------------------------------------------------
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

# Verify what got baked in
BAKED_URL=$(grep -ho "NEXT_PUBLIC_API_URL=[^\"]*" ../out/_next/static/chunks/*.js 2>/dev/null | head -1 | sed 's/NEXT_PUBLIC_API_URL=//' || echo "?")

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
