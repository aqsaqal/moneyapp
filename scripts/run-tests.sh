#!/bin/bash
#
# Lightweight test runner. Compiles each *.test.ts file with the project's
# tsc and runs it under node, with NODE_PATH pointing at the project's
# node_modules so relative deps resolve.
#
# Why not Jest? Adding jest + jest-expo + ts-jest pulls in ~200 deps and
# slows install for what's currently 1 test file. Re-evaluate if test
# count grows past ~5.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUTDIR="$(mktemp -d -t moneyflow-tests)"
trap 'rm -rf "$OUTDIR"' EXIT

# Find every *.test.ts in the source tree (portable for macOS bash 3).
TESTS=()
while IFS= read -r line; do
  TESTS+=("$line")
done < <(find features hooks utils -name "*.test.ts" -not -path "*/node_modules/*" 2>/dev/null)

if [ ${#TESTS[@]} -eq 0 ]; then
  echo "No tests found"
  exit 0
fi

# Compile all tests in one tsc invocation (faster than per-file).
npx tsc "${TESTS[@]}" \
  --outDir "$OUTDIR" \
  --module commonjs --target es2020 \
  --moduleResolution node --esModuleInterop --skipLibCheck \
  --rootDir . 2>&1

ANY_FAILED=0
for src in "${TESTS[@]}"; do
  out="$OUTDIR/${src%.ts}.js"
  echo ""
  echo "▶ $src"
  if ! NODE_PATH="$ROOT/node_modules" node "$out"; then
    ANY_FAILED=1
  fi
done

echo ""
if [ "$ANY_FAILED" = "0" ]; then
  echo "✅ all tests passed"
else
  echo "❌ test failures above"
  exit 1
fi
