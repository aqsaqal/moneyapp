#!/usr/bin/env bash
# Shared by build-aab.sh and build-demo-apk.sh: point the regenerated
# android project's release buildType at the upload keystore read from
# MONEYFLOW_RELEASE_* (env or ~/.gradle/gradle.properties).
#
#   source scripts/android-signing.sh
#   inject_release_signing android/app/build.gradle

inject_release_signing() {
  local GRADLE_BUILD="$1"
  # Release signing — the default expo template signs release builds with
  # the debug keystore (fine for sideloading, rejected by Play Console).
  # Inject a release signingConfig that reads MONEYFLOW_RELEASE_* from
  # ~/.gradle/gradle.properties, and point the release buildType at it.
  # Both edits are idempotent against the template expo prebuild emits.
  if [ -z "${MONEYFLOW_RELEASE_STORE_FILE:-}" ] && ! grep -q "^MONEYFLOW_RELEASE_STORE_FILE" "$HOME/.gradle/gradle.properties" 2>/dev/null; then
    echo "[build-aab] WARNING: MONEYFLOW_RELEASE_STORE_FILE not set in env or ~/.gradle/gradle.properties." >&2
    echo "[build-aab]          AAB will be signed with the debug keystore — Play Console will reject it." >&2
  fi

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
  # Both spellings: the Expo template writes `signingConfig signingConfigs.debug`,
  # the expo-iap plugin normalizes it to `signingConfig = signingConfigs.debug`.
  sed "${SED_INPLACE[@]}" '/release {$/,/^        }/ {
    s/signingConfig *=* *signingConfigs\.debug/signingConfig = signingConfigs.release/
  }' "$GRADLE_BUILD"
  if ! grep -q "signingConfig = signingConfigs.release" "$GRADLE_BUILD"; then
    echo "[build-aab] FAILED — could not point the release buildType at signingConfigs.release." >&2
    exit 1
  fi

}
