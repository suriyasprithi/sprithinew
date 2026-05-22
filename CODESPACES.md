# Building Android APKs in GitHub Codespaces

This repo is wired so a fresh GitHub Codespace can build **debug APKs** for both
the customer app and the staff app, with no local Android Studio / JDK setup
needed on your machine.

> ⚠️ **Debug builds only.** Output APKs are signed with the standard Android
> debug keystore — fine for sideloading onto your own phone for testing, **not**
> for the Play Store. Release signing is a separate step we haven't set up yet.
>
> ⚠️ **iOS is out of scope.** Codespaces is Linux; iOS `.ipa` builds need
> macOS + Xcode. Use Codemagic / EAS Build / a Mac for that.

---

## One-time setup

1. Push this repo to GitHub.
2. On GitHub, open the repo → **Code** → **Codespaces** → **Create codespace on
   `main`** (or your branch).
3. The first time it opens, the container provisions:
   - Node.js 20 (from the base image)
   - JDK 17 (via the `java` devcontainer feature)
   - Android SDK cmdline-tools, platform-tools, `platforms;android-34`,
     `build-tools;34.0.0` (via [`.devcontainer/setup-android.sh`](.devcontainer/setup-android.sh))

   This takes **5–10 minutes** on first create. Subsequent starts of the same
   Codespace are instant — the SDK is cached on the container volume.

4. When the terminal shows `==> Done.`, you're ready.

---

## Building an APK

Run one of these from the Codespace terminal:

```bash
# Customer app  →  com.epey.customer
bash customer-app/scripts/build-apk.sh

# Staff app     →  com.epey.staff
bash staff-app/scripts/build-apk.sh
```

Each script:

1. Installs npm deps (only if `node_modules/` is missing)
2. Runs `npm run build` → Next.js static export into `out/`
3. Runs `npx cap add android` if the `android/` folder doesn't exist yet
4. Runs `npx cap sync android` to copy `out/` into the native project
5. Runs `./gradlew assembleDebug` → produces the APK

First-ever build takes ~3–5 min (Gradle downloads dependencies into
`~/.gradle/caches`). Repeat builds are ~30–60 s.

---

## Downloading the APK

Both scripts print the absolute APK path at the end, e.g.

```
customer-app/android/app/build/outputs/apk/debug/app-debug.apk
staff-app/android/app/build/outputs/apk/debug/app-debug.apk
```

In the VS Code (web or desktop) file explorer connected to the Codespace:

1. Navigate to the path above.
2. Right-click `app-debug.apk` → **Download…**

Transfer it to your Android phone (USB, Drive, Telegram-to-self, whatever),
enable **Install unknown apps** for the source app, and tap to install.

---

## Pointing the APK at your backend

By default the APK is built against whatever `NEXT_PUBLIC_API_URL` is set to at
build time:

- `customer-app/.env.production` (committed) — production backend URL
- `staff-app/.env.production` (committed) — production backend URL

To build against a different backend (e.g. ngrok tunnel to your laptop):

```bash
# In the Codespace terminal, BEFORE running the build script
echo 'NEXT_PUBLIC_API_URL=https://your-tunnel.ngrok-free.app' \
  > customer-app/.env.production.local
bash customer-app/scripts/build-apk.sh
```

`.env.production.local` is gitignored — it won't be committed.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ANDROID_HOME is not set` | The `postCreateCommand` didn't finish. Run `bash .devcontainer/setup-android.sh` manually, then retry. |
| `JAVA_HOME is not set` or `java: command not found` | Rebuild the container: **Command Palette → Codespaces: Rebuild Container**. |
| `gradlew: Permission denied` | The script already does `chmod +x gradlew`. If you still hit it: `chmod +x customer-app/android/gradlew` then re-run. |
| Gradle fails with "Could not download…" | Network blip — re-run the script. Cached deps make the retry fast. |
| Out of disk space | Free tier Codespaces have ~32 GB. Run `rm -rf customer-app/android staff-app/android` to clean both native projects; the next build will regenerate them. |
| APK installs but app shows white screen | Check `NEXT_PUBLIC_API_URL` is reachable from your phone — the static export hard-codes it at build time. |

---

## What's NOT in this setup (yet)

- **Release-signed APKs** for the Play Store — needs a keystore (kept out of git,
  injected via Codespaces Secrets). Ask before adding; it changes the threat model.
- **iOS `.ipa` builds** — needs macOS, handle via Codemagic / EAS Build / a Mac.
- **Android emulator** — Codespaces is headless. Use a real phone or run the
  APK in an emulator on your local machine.
- **Push notification testing** — FCM only fires on a real device anyway.
  Install the debug APK on your phone, sign in, send a test push from the
  backend admin panel.
