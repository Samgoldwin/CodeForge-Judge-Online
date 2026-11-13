#!/usr/bin/env bash
set -euo pipefail

URL="${1:-${APP_URL:-}}"
APP_NAME="${APP_NAME:-CodeTest}"
APP_ID="${APP_ID:-com.codetest.app}"
OUT_DIR="${OUT_DIR:-out}"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0.0}"
KEYSTORE="${KEYSTORE:-codetest.keystore}"
KS_ALIAS="${KS_ALIAS:-codetest}"
KS_PASS="${KS_PASS:-codetest123}"
KEY_PASS="${KEY_PASS:-$KS_PASS}"
DNAME="${DNAME:-CN=CodeTest, OU=App, O=CodeTest, L=Unknown, ST=Unknown, C=US}"
WORKDIR="${WORKDIR:-.apk-build}"

if [ -z "$URL" ]; then
  echo "Usage: $0 <https://your-app-url>  (or set APP_URL)"
  echo "Generates a signed Android APK that opens the URL in a full-screen TWA."
  exit 1
fi
if [[ "$URL" != http://* && "$URL" != https://* ]]; then
  echo "Error: URL must start with http:// or https://"
  exit 1
fi

command -v npx >/dev/null || { echo "Error: Node.js/npx required"; exit 1; }
command -v java >/dev/null || { echo "Error: Java (JDK 17+) required for signing"; exit 1; }

mkdir -p "$WORKDIR" "$OUT_DIR"
cat > "$WORKDIR/twa-manifest.json" <<JSON
{
  "packageId": "$APP_ID",
  "host": "$(echo "$URL" | sed -E 's#https?://([^/]+).*#\1#')",
  "name": "$APP_NAME",
  "launcherName": "$APP_NAME",
  "display": "standalone",
  "themeColor": "#121212",
  "navigationColor": "#121212",
  "backgroundColor": "#121212",
  "enableNotifications": false,
  "startUrl": "/",
  "iconUrl": "$URL/icon-512.png",
  "maskableIconUrl": "$URL/icon-512.png",
  "splashScreenFadeOutDuration": 300,
  "signingKey": { "path": "../$KEYSTORE", "alias": "$KS_ALIAS" },
  "appVersionName": "$VERSION_NAME",
  "appVersionCode": $VERSION_CODE,
  "shortcuts": [],
  "generatorApp": "bubblewrap-cli",
  "fallbackType": "customtabs",
  "enableSiteSettingsShortcut": false,
  "isChromeOSOnly": false,
  "alphaDependencies": { "enabled": false },
  "features": {},
  "androidPackageId": "$APP_ID"
}
JSON

if [ ! -f "$KEYSTORE" ]; then
  echo "Generating keystore $KEYSTORE ..."
  keytool -genkeypair -v -keystore "$KEYSTORE" -alias "$KS_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KEY_PASS" -dname "$DNAME"
fi

echo "Initializing/updating TWA project..."
cd "$WORKDIR"
npx --yes @bubblewrap/cli init --manifest ./twa-manifest.json --directory . --skipPwaValidation || true
npx --yes @bubblewrap/cli build --manifest ./twa-manifest.json --skipPwaValidation \
  --signingKeyPath "../$KEYSTORE" --signingKeyAlias "$KS_ALIAS" \
  --signingKeyStorePassword "$KS_PASS" --signingKeyKeyPassword "$KEY_PASS"
cd ..

APK=$(find "$WORKDIR" -type f -name "*release*.apk" -o -name "*signed*.apk" | head -n 1 || true)
if [ -z "$APK" ]; then APK=$(find "$WORKDIR" -type f -name "*.apk" | head -n 1 || true); fi
if [ -z "$APK" ]; then echo "Error: APK not found in $WORKDIR"; exit 1; fi
cp "$APK" "$OUT_DIR/${APP_NAME// /-}.apk"
echo "Signed APK: $OUT_DIR/${APP_NAME// /-}.apk"
echo "Install: adb install -r \"$OUT_DIR/${APP_NAME// /-}.apk\""