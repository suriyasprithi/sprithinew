#!/usr/bin/env bash
# ============================================================================
#  SPRITHI Customer APK — full build in a FRESH GitHub Codespace
# ----------------------------------------------------------------------------
#  Produces a SIGNED  app-release.apk  +  app-release.aab  with:
#     * Launcher icon + splash + notification logo
#     * Native share (@capacitor/share)
#     * Camera (QR scanner)
#     * No-zoom (locked viewport)
#     * versionCode 5
#
#  Run SECTION BY SECTION (recommended), or all at once:  bash customer-app/APK_BUILD_COMMANDS.sh
#  (No-zoom + native share are already baked into the web bundle — nothing extra to do.)
# ============================================================================


# ===== 0. ONE-TIME per Codespace: Java 21 + Android SDK  (skip if already done) =====
sudo apt-get update
sudo apt-get install -y openjdk-21-jdk unzip
export ANDROID_HOME="$HOME/android-sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"
cd "$ANDROID_HOME/cmdline-tools"
curl -L -o tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q -o tools.zip && mv -f cmdline-tools latest && rm tools.zip
# persist env for new terminals
cat >> ~/.bashrc <<'RC'
export ANDROID_HOME="$HOME/android-sdk"
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/36.0.0"
RC
source ~/.bashrc
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"


# ===== 1. Project deps + production API URL =====
cd /workspaces/sprithinew/customer-app
npm install
printf 'NEXT_PUBLIC_API_URL=https://app.sprithi.com\nNEXT_PUBLIC_REFERRAL_DOMAIN=https://app.sprithi.com\n' > .env.production


# ===== 2. Web build (empty basePath) + fresh android =====
rm -rf android out .next
CAPACITOR_BUILD=1 npm run build
npx cap add android


# ===== 3. Camera permission (QR scanner) =====
grep -q 'android.permission.CAMERA' android/app/src/main/AndroidManifest.xml || \
  sed -i 's#<application#<uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n\n    <application#' android/app/src/main/AndroidManifest.xml


# ===== 4. Push notifications — google-services.json (com.epey.customer) =====
cp firebase/google-services.json android/app/


# ===== 5. Icons — launcher + splash + notification =====
npx @capacitor/assets generate --android
cp -r notification-res/drawable-* android/app/src/main/res/
grep -q 'default_notification_icon' android/app/src/main/AndroidManifest.xml || \
  sed -i 's#</application>#    <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_notification" />\n</application>#' android/app/src/main/AndroidManifest.xml


# ===== 6. Version code =====
sed -i -E 's/versionCode[[:space:]]+[0-9]+/versionCode 5/' android/app/build.gradle


# ===== 7. Signing (SPRITHI keystore, alias 'sprithi') =====
read -rsp 'Keystore password: ' PW; echo
printf 'storeFile=../../newww/sprithi-release.jks\nstorePassword=%s\nkeyAlias=sprithi\nkeyPassword=%s\n' "$PW" "$PW" > android/keystore.properties
printf '\ndef ksP=new Properties()\ndef ksF=rootProject.file("keystore.properties")\nif(ksF.exists()){\n  ksF.withInputStream{ksP.load(it)}\n  android{\n    signingConfigs{release{storeFile file(ksP["storeFile"]);storePassword ksP["storePassword"];keyAlias ksP["keyAlias"];keyPassword ksP["keyPassword"]}}\n    buildTypes{release{signingConfig signingConfigs.release}}\n  }\n}\n' >> android/app/build.gradle


# ===== 8. Build signed APK + AAB =====
cd android
./gradlew clean assembleRelease bundleRelease
ls -la app/build/outputs/apk/release/ app/build/outputs/bundle/release/
"$(find $ANDROID_HOME/build-tools -name apksigner | sort -V | tail -1)" verify --print-certs app/build/outputs/apk/release/app-release.apk

# Outputs:
#   android/app/build/outputs/apk/release/app-release.apk    (signed -> install on phone)
#   android/app/build/outputs/bundle/release/app-release.aab  (signed -> Play Console)
#
# Reinstall the APK, then: launcher+splash+notification logo, native share,
# QR camera (tap Allow once), no pinch-zoom, version 1.0 (5).
