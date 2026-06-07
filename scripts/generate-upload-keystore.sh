#!/usr/bin/env bash
#
# One-time setup: generate the Android upload keystore used to sign
# release AABs before they go to Google Play. Google Play App Signing
# means Google holds the real signing key; this upload key is just our
# handshake with Play Console.
#
# RUN ONCE PER ACCOUNT. Loss of this file + passwords blocks future
# uploads until you go through Play's key reset flow — keep a backup
# in 1Password / iCloud Keychain / encrypted drive.
#
# Usage:
#   bash scripts/generate-upload-keystore.sh
#
# Outputs:
#   ~/.android-keystores/moneyflow-upload.jks    — the keystore file
#   stdout                                         — the env vars to copy into
#                                                    ~/.gradle/gradle.properties
#                                                    or your shell rc

set -euo pipefail

KEYSTORE_DIR="$HOME/.android-keystores"
KEYSTORE_PATH="$KEYSTORE_DIR/moneyflow-upload.jks"
ALIAS="upload"

if [ -f "$KEYSTORE_PATH" ]; then
  echo "ERROR: $KEYSTORE_PATH already exists." >&2
  echo "If you intend to re-generate, move it aside first:" >&2
  echo "  mv $KEYSTORE_PATH $KEYSTORE_PATH.bak-\$(date +%s)" >&2
  exit 1
fi

mkdir -p "$KEYSTORE_DIR"
chmod 700 "$KEYSTORE_DIR"

echo "Generating upload keystore at $KEYSTORE_PATH"
echo "You'll be prompted for:"
echo "  - a STORE password (≥ 6 chars; back this up)"
echo "  - the same password re-entered"
echo "  - a KEY password (you can press RETURN to reuse the store password)"
echo "  - an X.500 distinguished name (you can use placeholders — Play"
echo "    only cares that the upload key is consistent across uploads)"
echo ""

# RSA 4096 / SHA256 / 10000-day validity (~27 years) — Play uploads
# accept anything ≥ 25 years from now at first submission.
keytool -genkeypair \
  -v \
  -keystore "$KEYSTORE_PATH" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -storetype JKS

chmod 600 "$KEYSTORE_PATH"

cat <<EOF

✅ Keystore created.

NEXT STEPS:

1. Back up $KEYSTORE_PATH (and the passwords) somewhere offline.
   Without it you can't ship updates as the upload key. Play's recovery
   path is a 1-2 day request flow — don't rely on it.

2. Add these lines to ~/.gradle/gradle.properties (create the file if
   it doesn't exist) so future "bash scripts/build-aab.sh ..." signs the
   AAB before upload:

   MONEYFLOW_RELEASE_STORE_FILE=$KEYSTORE_PATH
   MONEYFLOW_RELEASE_KEY_ALIAS=$ALIAS
   MONEYFLOW_RELEASE_STORE_PASSWORD=<the store password you just set>
   MONEYFLOW_RELEASE_KEY_PASSWORD=<the key password (same as store if you reused)>

3. Confirm the wiring by running:

   bash scripts/build-aab.sh generic

   Output AAB lands at android/app/build/outputs/bundle/release/app-release.aab
EOF
