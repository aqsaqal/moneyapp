#!/usr/bin/env bash
# Build a Play-Store-ready Android App Bundle (.aab) for the requested flavor.
#
# Usage:
#   bash scripts/build-aab.sh generic    # Flow
#   bash scripts/build-aab.sh islamic    # Amanah
#
# Requires:
#   - ANDROID_HOME (or $HOME/Library/Android/sdk fallback)
#   - A release keystore. Set the following in ~/.gradle/gradle.properties or
#     environment before running for a signed build (keystore stays out of git):
#       MONEYFLOW_RELEASE_STORE_FILE=/abs/path/keystore.jks
#       MONEYFLOW_RELEASE_KEY_ALIAS=upload
#       MONEYFLOW_RELEASE_STORE_PASSWORD=...
#       MONEYFLOW_RELEASE_KEY_PASSWORD=...
#
# Without those env vars, gradle produces an unsigned bundle suitable for
# upload to Play Console (which then signs with the App Signing key).
set -euo pipefail

FLAVOR="${1:?usage: build-aab.sh <generic|islamic>}"
case "$FLAVOR" in
  generic|islamic) ;;
  *) echo "flavor must be 'generic' or 'islamic'" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

echo "[build-aab] preparing $FLAVOR flavor…"
APP_FLAVOR="$FLAVOR" node scripts/prepare-flavor.js

echo "[build-aab] regenerating native android/ from app.config.ts…"
rm -rf android
APP_FLAVOR="$FLAVOR" npx expo prebuild --platform android --no-install --clean

# expo prebuild doesn't write local.properties; ensure it exists.
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
# Phase 7 carryover: @react-native-voice/voice still ships pre-AndroidX deps.
grep -q '^android.enableJetifier=' android/gradle.properties || \
  echo 'android.enableJetifier=true' >> android/gradle.properties

# Release signing — the default expo template signs release builds with
# the debug keystore (fine for sideloading, rejected by Play Console).
# Inject a release signingConfig that reads MONEYFLOW_RELEASE_* from
# ~/.gradle/gradle.properties, and point the release buildType at it.
# Both edits are idempotent against the template expo prebuild emits.
if [ -z "${MONEYFLOW_RELEASE_STORE_FILE:-}" ] && ! grep -q "^MONEYFLOW_RELEASE_STORE_FILE" "$HOME/.gradle/gradle.properties" 2>/dev/null; then
  echo "[build-aab] WARNING: MONEYFLOW_RELEASE_STORE_FILE not set in env or ~/.gradle/gradle.properties." >&2
  echo "[build-aab]          AAB will be signed with the debug keystore — Play Console will reject it." >&2
fi

GRADLE_BUILD="android/app/build.gradle"
# Add a release signingConfig sibling to the existing debug one. Use a
# sentinel comment so re-running doesn't duplicate.
if ! grep -q "MONEYFLOW_RELEASE_STORE_FILE" "$GRADLE_BUILD"; then
  awk '
    /signingConfigs \{/ && !done {
      print
      print "        release {"
      print "            if (project.hasProperty(\"MONEYFLOW_RELEASE_STORE_FILE\")) {"
      print "                storeFile file(MONEYFLOW_RELEASE_STORE_FILE)"
      print "                storePassword MONEYFLOW_RELEASE_STORE_PASSWORD"
      print "                keyAlias MONEYFLOW_RELEASE_KEY_ALIAS"
      print "                keyPassword MONEYFLOW_RELEASE_KEY_PASSWORD"
      print "            }"
      print "        }"
      done = 1
      next
    }
    { print }
  ' "$GRADLE_BUILD" > "$GRADLE_BUILD.tmp" && mv "$GRADLE_BUILD.tmp" "$GRADLE_BUILD"
fi
# Switch the release buildType from signingConfigs.debug → signingConfigs.release.
# sed -i syntax differs between BSD (macOS) and GNU (linux); detect.
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(-i)
else
  SED_INPLACE=(-i '')
fi
sed "${SED_INPLACE[@]}" '/release {$/,/^        }/ {
  s/signingConfig signingConfigs.debug/signingConfig signingConfigs.release/
}' "$GRADLE_BUILD"

echo "[build-aab] gradle bundleRelease ($FLAVOR)…"
cd android
APP_FLAVOR="$FLAVOR" ./gradlew app:bundleRelease

OUT_AAB="app/build/outputs/bundle/release/app-release.aab"
if [ ! -f "$OUT_AAB" ]; then
  echo "[build-aab] FAILED — $OUT_AAB not produced." >&2
  exit 1
fi

DEST="/tmp/${FLAVOR}-release.aab"
cp "$OUT_AAB" "$DEST"

echo
echo "[build-aab] ✅ AAB ready: $DEST"
echo "    size: $(du -h "$DEST" | awk '{print $1}')"
echo "    upload to Play Console → Production → Create new release."
