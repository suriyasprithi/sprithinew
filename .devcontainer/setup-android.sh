#!/usr/bin/env bash
# One-shot Android SDK setup for Codespaces.
# Runs once on container create. Idempotent — re-running is safe.
set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
CMDLINE_VERSION="11076708"  # cmdline-tools latest, Linux
PLATFORM="android-34"
BUILD_TOOLS="34.0.0"

echo "==> Android SDK setup → $ANDROID_HOME"

if [ -d "$ANDROID_HOME/platform-tools" ] && [ -d "$ANDROID_HOME/platforms/$PLATFORM" ]; then
  echo "==> SDK already present, skipping install."
else
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  cd "$ANDROID_HOME/cmdline-tools"

  if [ ! -d "latest" ]; then
    echo "==> Downloading cmdline-tools ($CMDLINE_VERSION)…"
    curl -sSLo cmdline-tools.zip \
      "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_VERSION}_latest.zip"
    unzip -q cmdline-tools.zip
    mv cmdline-tools latest
    rm cmdline-tools.zip
  fi

  export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

  echo "==> Accepting licenses…"
  yes | sdkmanager --licenses > /dev/null 2>&1 || true

  echo "==> Installing platform-tools, platforms;$PLATFORM, build-tools;$BUILD_TOOLS…"
  sdkmanager --install \
    "platform-tools" \
    "platforms;$PLATFORM" \
    "build-tools;$BUILD_TOOLS" > /dev/null
fi

# Make build scripts in this repo executable (idempotent).
chmod +x customer-app/scripts/build-apk.sh 2>/dev/null || true
chmod +x staff-app/scripts/build-apk.sh 2>/dev/null || true

echo ""
echo "==> Done."
echo "    ANDROID_HOME = $ANDROID_HOME"
echo "    Java         = $(java -version 2>&1 | head -n1)"
echo ""
echo "    Build customer APK:  bash customer-app/scripts/build-apk.sh"
echo "    Build staff APK:     bash staff-app/scripts/build-apk.sh"
