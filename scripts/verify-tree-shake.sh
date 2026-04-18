#!/bin/bash
#
# Tree-shake verification — proves Islamic code is physically excluded from
# the generic bundle. Required gate before any generic-flavor release.
#
# Layers verified:
#   A) plain-text assets (filenames, JSON manifests)
#   B) Hermes bytecode string pool — RAW-BYTE grep, not `strings`
#      (Hermes packs literals tightly; `strings` requires runs of >=4
#       printable chars and misses adjacency-packed entries)
#   C) Sanity check: same scan against the islamic build MUST find tokens
#      (otherwise the verification is a false negative)
#
# Strings considered acceptable in generic (shared infra, NEVER user-facing):
#   halal_status, setHalalStatus  - column name + mutation function from the
#                                   shared schema/hooks. Never written/read
#                                   in generic; just plumbed through.
#
# Strings that MUST NOT appear in generic (Islamic-specific UI/features):
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FORBIDDEN_TOKENS=(
  Zakat Sadaqa Hijri Ramadan
  nisab hawl mazhab
  Qurban Hajj Amanah
  mushbooh haram
  umalqura adhan
  HIJRI_CANARY ZAKAT_TEST_STRING AMANAH_CANARY
  ibm-plex-sans-arabic
  features/islamic app-islamic
  Mecca Aladhan
)

# ----- Build generic -----
echo "=== Building generic bundle ==="
rm -rf dist/generic node_modules/.cache .expo
APP_FLAVOR=generic node scripts/prepare-flavor.js
APP_FLAVOR=generic npx expo export --platform ios --output-dir dist/generic --clear >/tmp/verify-export-generic.log 2>&1 || {
  echo "FAIL: generic export failed"; tail -30 /tmp/verify-export-generic.log; exit 1
}

# ----- Layer A: plain-text assets -----
echo ""
echo "=== Layer A: plain-text assets / manifest ==="
LAYER_A_FAIL=0
for tok in "${FORBIDDEN_TOKENS[@]}"; do
  if grep -RIqi "$tok" dist/generic/assets/ dist/generic/metadata.json 2>/dev/null; then
    echo "  FAIL: '$tok' found in generic assets/manifest"
    LAYER_A_FAIL=1
  fi
done
[ "$LAYER_A_FAIL" = "0" ] && echo "  OK"

# ----- Layer B: Hermes bytecode string pool -----
echo ""
echo "=== Layer B: Hermes bytecode (raw-byte grep, NOT \`strings\`) ==="
LAYER_B_FAIL=0
HBC_FILES=$(find dist/generic/_expo -name "*.hbc" 2>/dev/null)
if [ -z "$HBC_FILES" ]; then
  echo "  FAIL: no .hbc files found in dist/generic/_expo/"; exit 1
fi
for hbc in $HBC_FILES; do
  echo "  scanning $(basename "$hbc") ($(ls -lh "$hbc" | awk '{print $5}'))"
  for tok in "${FORBIDDEN_TOKENS[@]}"; do
    COUNT=$( { LC_ALL=C grep -ao "$tok" "$hbc" 2>/dev/null || true; } | wc -l | tr -d ' ')
    if [ "$COUNT" != "0" ]; then
      echo "    FAIL: '$tok' found ($COUNT match$([ "$COUNT" != "1" ] && echo es))"
      LAYER_B_FAIL=1
    fi
  done
done
[ "$LAYER_B_FAIL" = "0" ] && echo "  OK"

# ----- Layer C: islamic sanity (avoid false negatives) -----
echo ""
echo "=== Layer C: islamic sanity check ==="
rm -rf dist/islamic node_modules/.cache .expo
APP_FLAVOR=islamic node scripts/prepare-flavor.js
APP_FLAVOR=islamic npx expo export --platform ios --output-dir dist/islamic --clear >/tmp/verify-export-islamic.log 2>&1 || {
  echo "FAIL: islamic export failed"; tail -30 /tmp/verify-export-islamic.log; exit 1
}
ISLAMIC_HBC=$(find dist/islamic/_expo -name "*.hbc" 2>/dev/null | head -1)
if [ -z "$ISLAMIC_HBC" ]; then
  echo "  FAIL: no islamic .hbc found"; exit 1
fi
LAYER_C_FAIL=0
# These tokens MUST appear in the islamic bundle. If any is missing, the
# tree-shake check is suspect — we'd be matching against a build that
# doesn't actually include Islamic features, so a "clean generic" passes
# trivially.
SANITY_TOKENS=(Zakat Sadaqa Hijri Ramadan nisab hawl umalqura mushbooh)
for tok in "${SANITY_TOKENS[@]}"; do
  COUNT=$( { LC_ALL=C grep -ao "$tok" "$ISLAMIC_HBC" 2>/dev/null || true; } | wc -l | tr -d ' ')
  if [ "$COUNT" = "0" ]; then
    echo "  FAIL: islamic bundle missing '$tok' — sanity broken"
    LAYER_C_FAIL=1
  fi
done
[ "$LAYER_C_FAIL" = "0" ] && echo "  OK ($(ls -lh "$ISLAMIC_HBC" | awk '{print $5}'))"

# ----- Layer D (manual): final shipping artifact -----
# Run after `eas build --profile generic` produces an .ipa or .apk:
#   strings build/generic.apk | grep -Ei "Zakat|Hijri|Sadaqa"
# Comment retained as documentation.

echo ""
if [ "$LAYER_A_FAIL" = "0" ] && [ "$LAYER_B_FAIL" = "0" ] && [ "$LAYER_C_FAIL" = "0" ]; then
  echo "✅ PASS: generic bundle clean across all layers"
  echo "   (gold-standard verification still requires \`strings\` on the final"
  echo "    .ipa/.apk after eas build — see the script comment for steps)"
  exit 0
else
  echo "❌ FAIL: tree-shake leaked or sanity broken"
  exit 1
fi
