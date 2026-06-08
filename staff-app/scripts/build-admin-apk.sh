#!/usr/bin/env bash
# Build the dedicated ADMIN debug APK inside Codespaces.
#
# Thin wrapper over build-apk.sh with ADMIN_BUILD=1, which switches:
#   - appId   → com.epey.admin   (installs alongside the staff app)
#   - appName → SPRITHI Admin
#   - start   → /control          (the hidden admin login)
#   - firebase config dir → staff-app/firebase-admin/google-services.json
#
# Usage (same as build-apk.sh):
#   bash staff-app/scripts/build-admin-apk.sh https://app.sprithi.com
#
# Push notifications need a Firebase Android app registered for com.epey.admin
# in the SAME Firebase project as the staff app; drop its google-services.json
# at staff-app/firebase-admin/google-services.json before building.
set -euo pipefail

ADMIN_BUILD=1 bash "$(dirname "$0")/build-apk.sh" "$@"
