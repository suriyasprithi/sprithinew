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

# ---------------------------------------------------------------------------
# 5. Copy web assets into native project
# ---------------------------------------------------------------------------
echo "==> cap sync android…"
npx cap sync android

# Referral App Links: route https://app.sprithi.com/ref/* into the app.
bash "$(dirname "$0")/patch-applinks.sh"

# ---------------------------------------------------------------------------
# 5b. Wire Firebase Android config AFTER cap sync (cap sync may rewrite gradle
#     files, so we patch after). Source of truth: customer-app/firebase/.
# ---------------------------------------------------------------------------
if [ -f "firebase/google-services.json" ]; then
  echo "==> Copying firebase/google-services.json → android/app/"
  cp firebase/google-services.json android/app/google-services.json

  PROJECT_GRADLE="android/build.gradle"
  if ! grep -q "com.google.gms:google-services" "$PROJECT_GRADLE"; then
    echo "==> Patching $PROJECT_GRADLE to add google-services classpath"
    awk '
      /buildscript[[:space:]]*\{/ { in_bs = 1 }
      in_bs && /dependencies[[:space:]]*\{/ && !done {
        print
        print "        classpath '\''com.google.gms:google-services:4.4.2'\''"
        done = 1
        next
      }
      { print }
    ' "$PROJECT_GRADLE" > "$PROJECT_GRADLE.tmp" && mv "$PROJECT_GRADLE.tmp" "$PROJECT_GRADLE"
  fi
  APP_GRADLE="android/app/build.gradle"
  if ! grep -q "com.google.gms.google-services" "$APP_GRADLE"; then
    echo "==> Patching $APP_GRADLE to apply google-services plugin"
    echo "" >> "$APP_GRADLE"
    echo "apply plugin: 'com.google.gms.google-services'" >> "$APP_GRADLE"
  fi

  echo "==> Verifying Firebase wiring:"
  echo "    google-services.json exists: $(test -f android/app/google-services.json && echo YES || echo NO)"
  echo "    classpath in project gradle: $(grep -c "com.google.gms:google-services" "$PROJECT_GRADLE") line(s)"
  echo "    plugin in app gradle:        $(grep -c "com.google.gms.google-services" "$APP_GRADLE") line(s)"
  echo "    package_name match for com.epey.customer: $(grep -c "com.epey.customer" android/app/google-services.json) match(es)"

  # Generate monochrome notification status-bar icon — Android API 21+ strips
  # color from status bar icons, so the launcher icon shows as a white square.
  NOTIF_SRC=""
  if [ -f "resources/notification-icon.png" ]; then
    NOTIF_SRC="resources/notification-icon.png"
  elif [ -f "resources/icon.png" ]; then
    NOTIF_SRC="resources/icon.png"
  fi

  if [ -n "$NOTIF_SRC" ] && command -v convert >/dev/null 2>&1; then
    echo "==> Generating notification icons from $NOTIF_SRC (silhouette)"
    declare -A NOTIF_SIZES=(
      [mdpi]=24
      [hdpi]=36
      [xhdpi]=48
      [xxhdpi]=72
      [xxxhdpi]=96
    )
    for density in "${!NOTIF_SIZES[@]}"; do
      size="${NOTIF_SIZES[$density]}"
      inner=$(( size * 65 / 100 ))
      target_dir="android/app/src/main/res/drawable-$density"
      mkdir -p "$target_dir"
      convert "$NOTIF_SRC" \
        -channel RGB -evaluate set 255 +channel \
        -resize "${inner}x${inner}" \
        -background none -gravity center -extent "${size}x${size}" \
        "$target_dir/ic_stat_notification.png" 2>/dev/null
    done
    MANIFEST="android/app/src/main/AndroidManifest.xml"
    if ! grep -q "default_notification_icon" "$MANIFEST"; then
      echo "==> Patching $MANIFEST to register ic_stat_notification"
      sed -i 's|</application>|        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_notification" />\n    </application>|' "$MANIFEST"
    fi
    echo "    Notification icon: drawable-mdpi/ic_stat_notification.png $(test -f android/app/src/main/res/drawable-mdpi/ic_stat_notification.png && echo YES || echo NO)"
    echo "    Manifest meta-data registered: $(grep -c "default_notification_icon" "$MANIFEST") line(s)"
  fi
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
