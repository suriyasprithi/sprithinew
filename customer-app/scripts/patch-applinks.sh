#!/usr/bin/env bash
# Patch the customer app's AndroidManifest with the referral App Links
# intent-filter, so tapping https://app.sprithi.com/ref/* opens the installed
# app directly (verified via /.well-known/assetlinks.json on the server).
#
# `android/` is regenerated per environment and the manifest patch does NOT
# survive `cap add android`, so run this AFTER `cap add` / `cap sync` and BEFORE
# the Gradle build. Idempotent — safe to run repeatedly.
#
# Usage (from customer-app/):  bash scripts/patch-applinks.sh
set -euo pipefail

cd "$(dirname "$0")/.."   # → customer-app/

HOST="${REFERRAL_HOST:-app.sprithi.com}"
MANIFEST="android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: $MANIFEST not found. Run 'npx cap add android' / 'npx cap sync android' first." >&2
  exit 1
fi

if grep -q 'android:pathPrefix="/ref/"' "$MANIFEST"; then
  echo "==> App Links intent-filter already present — skipping."
  exit 0
fi

echo "==> Adding /ref/ App Links intent-filter (host=$HOST) to $MANIFEST"
awk -v host="$HOST" '
  /<\/activity>/ && !done {
    print "        <intent-filter android:autoVerify=\"true\">"
    print "            <action android:name=\"android.intent.action.VIEW\" />"
    print "            <category android:name=\"android.intent.category.DEFAULT\" />"
    print "            <category android:name=\"android.intent.category.BROWSABLE\" />"
    print "            <data android:scheme=\"https\" android:host=\"" host "\" android:pathPrefix=\"/ref/\" />"
    print "        </intent-filter>"
    done = 1
  }
  { print }
' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"

echo "    intent-filter lines now: $(grep -c 'android:pathPrefix="/ref/"' "$MANIFEST")"
