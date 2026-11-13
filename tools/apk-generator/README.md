# APK generator (TWA)

Generates a signed Android APK that opens your deployed site URL full-screen (Trusted Web Activity) with a splash screen (theme/background/icon from manifest). No APK download hosting needed — build once, share the APK.

## Prerequisites
- Node.js (npx) + npm
- JDK 17+ (`java`, `keytool`, `jarsigner`) and Android SDK/Gradle env for Bubblewrap build
- A deployed HTTPS URL of this app (PWA-ready: `manifest.webmanifest`, icons, service worker)

## Usage (Git Bash/WSL/Linux/macOS)
```bash
bash tools/apk-generator/generate-apk.sh "https://your-deployed-site.example"
```
Env overrides: `APP_URL, APP_NAME, APP_ID, OUT_DIR, VERSION_CODE, VERSION_NAME, KEYSTORE, KS_ALIAS, KS_PASS, KEY_PASS, DNAME`.

## Output
- Signed APK copied to `out/CodeTest.apk` (by default)
- Keystore created as `codetest.keystore` if missing (keep it to update the same app)

## Notes
- The URL is baked into the APK (TWA host/start URL). Re-run with a new URL to target a different site.
- For full "verified" TWA (no browser bar) you must host an assetlinks.json on the site matching the app signing cert; as a fallback Bubblewrap may use Custom Tabs if verification is not set up.
- Splash uses `theme_color`/`background_color` and the app icon from the web manifest.
