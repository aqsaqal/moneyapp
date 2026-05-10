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

# Compile all tests via a temp tsconfig that mirrors the project's path
# aliases (`@/*` → `./*`) so feature modules can import from `@/utils/...`
# the same way the app bundle does. tsc rejects --paths on the CLI, so a
# tsconfig file is the supported path.
TSCONFIG="$OUTDIR/tsconfig.tests.json"
{
  echo '{'
  echo '  "compilerOptions": {'
  echo '    "outDir": "'"$OUTDIR"'/dist",'
  echo '    "module": "commonjs",'
  echo '    "target": "es2020",'
  echo '    "moduleResolution": "node",'
  echo '    "esModuleInterop": true,'
  echo '    "skipLibCheck": true,'
  echo '    "baseUrl": "'"$ROOT"'",'
  echo '    "paths": { "@/*": ["./*"] },'
  echo '    "rootDir": "'"$ROOT"'",'
  echo '    "resolveJsonModule": true,'
  echo '    "typeRoots": ["'"$ROOT"'/node_modules/@types"],'
  echo '    "types": ["node"]'
  echo '  },'
  echo -n '  "files": ['
  for i in "${!TESTS[@]}"; do
    [ "$i" -gt 0 ] && echo -n ','
    echo -n "\"$ROOT/${TESTS[$i]}\""
  done
  echo ']'
  echo '}'
} > "$TSCONFIG"

npx tsc -p "$TSCONFIG" 2>&1
DIST_ROOT="$OUTDIR/dist"

# tsc leaves `@/...` imports literal in the emitted JS — Node can't resolve
# them. Rewrite via a tiny Node post-processor (not tsc-alias, which only
# scans the original include glob and misses transitive deps compiled
# through `files`). For each .js, replace `require("@/x/y")` with the
# relative path from that file to OUTDIR/dist/x/y.
node -e "
  const fs = require('fs'), path = require('path');
  const dist = process.argv[1];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && p.endsWith('.js')) {
        const src = fs.readFileSync(p, 'utf8');
        const fixed = src.replace(/require\(\"@\/(.*?)\"\)/g, (_, sub) => {
          const target = path.join(dist, sub);
          let rel = path.relative(path.dirname(p), target);
          if (!rel.startsWith('.')) rel = './' + rel;
          return 'require(\"' + rel + '\")';
        });
        if (fixed !== src) fs.writeFileSync(p, fixed);
      }
    }
  }
  walk(dist);
" "$DIST_ROOT"

ANY_FAILED=0
for src in "${TESTS[@]}"; do
  out="$DIST_ROOT/${src%.ts}.js"
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
