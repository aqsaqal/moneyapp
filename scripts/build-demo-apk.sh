#!/usr/bin/env bash
# Demo APK for the S26 and internal testers: the generic flavor with its
# own package (com.moneyflow.generic.demo), name "Flow Demo", link scheme
# flowdemo, and Settings → Demo controls (EXPO_PUBLIC_DEMO_CONTROLS=1).
# Installs beside the store build with separate data.
#
#   bash scripts/build-demo-apk.sh            # build + install on the first adb device
#   bash scripts/build-demo-apk.sh --no-install
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# The same values must be present at prebuild (manifest, scheme, icon)
# and at the gradle bundling step (app.config.ts is evaluated again for
# the embedded config), so export them once.
export APP_FLAVOR=generic
export APP_NAME="Flow Demo"
export APP_BUNDLE_ID=com.moneyflow.generic.demo
export APP_SCHEME=flowdemo
export PRIMARY_COLOR='#00E09E'
export EXPO_PUBLIC_DEMO_CONTROLS=1

echo "[demo] preparing flavor…"
node scripts/prepare-flavor.js
echo "[demo] regenerating android/ as ${APP_BUNDLE_ID}…"
rm -rf android
npx expo prebuild --platform android --no-install --clean
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
grep -q '^android.enableJetifier=' android/gradle.properties || echo 'android.enableJetifier=true' >> android/gradle.properties

source "$ROOT/scripts/android-signing.sh"
inject_release_signing android/app/build.gradle

cd android
# A running daemon would not see the exported variables.
./gradlew --stop >/dev/null 2>&1 || true
./gradlew app:assembleRelease -x lint -x test
APK="app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || { echo "[demo] FAILED — no APK" >&2; exit 1; }
echo "[demo] APK: $ROOT/android/$APK"
if [ "${1:-}" != "--no-install" ]; then
  # Main profile only: the S26 has a second (work/dual) user that should not get the demo.
  "$ANDROID_HOME/platform-tools/adb" install --user 0 -r "$APK"
fi
echo "[demo] done. The android/ folder is now the demo variant; build-aab.sh regenerates it for store builds."
