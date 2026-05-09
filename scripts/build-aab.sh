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
