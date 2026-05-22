#!/usr/bin/env bash
# Build a debug APK for staff-app inside Codespaces (or any Linux box with
# Android SDK + JDK 17 installed via .devcontainer/setup-android.sh).
set -euo pipefail

cd "$(dirname "$0")/.."   # → staff-app/

APP_NAME="staff-app"
echo "==> $APP_NAME → Android debug APK"

# 1. Sanity checks
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: ANDROID_HOME is not set. Did the devcontainer postCreate finish?" >&2
  exit 1
fi
if ! command -v java >/dev/null; then
  echo "ERROR: java not on PATH. Expected JDK 21 from devcontainer feature." >&2
  exit 1
fi

# 2. Install npm deps if missing
if [ ! -d "node_modules" ]; then
  echo "==> Installing npm dependencies…"
  npm install --no-audit --no-fund
fi

# 3. Next.js static export → out/
echo "==> Building Next.js (static export)…"
npm run build

# 4. Add android platform on first run
if [ ! -d "android" ]; then
  echo "==> First run: adding Android platform via Capacitor…"
  npx cap add android
fi

# 5. Copy web assets into native project
echo "==> cap sync android…"
npx cap sync android

# 6. Build debug APK
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
echo "  Path:  $APK"
echo "  Size:  $SIZE"
echo "===================================================================="
echo ""
echo "  In Codespaces: right-click the APK in the file explorer → Download"
