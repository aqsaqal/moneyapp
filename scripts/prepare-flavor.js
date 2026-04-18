#!/usr/bin/env node
/**
 * Layer 4 of the tree-shake pipeline.
 *
 * Expo Router enumerates the `app/` directory structurally at build time — route
 * filenames become strings in the bundled manifest regardless of Metro resolver
 * behavior. To keep Islamic route names out of the generic bundle, we keep
 * Islamic routes in `app-islamic/` (invisible to Expo Router) and copy them into
 * `app/(islamic)/` only when APP_FLAVOR=islamic.
 *
 * Usage:
 *   APP_FLAVOR=generic  node scripts/prepare-flavor.js   # removes app/(islamic)/
 *   APP_FLAVOR=islamic  node scripts/prepare-flavor.js   # populates app/(islamic)/
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ISLAMIC = path.join(ROOT, 'app-islamic', '(islamic)');
const TARGET_ISLAMIC = path.join(ROOT, 'app', '(islamic)');

const flavor = process.env.APP_FLAVOR || 'generic';

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function main() {
  if (flavor === 'islamic') {
    if (!fs.existsSync(SOURCE_ISLAMIC)) {
      console.log(`[prepare-flavor] No source at ${SOURCE_ISLAMIC}; skipping.`);
      return;
    }
    rmrf(TARGET_ISLAMIC);
    copyDir(SOURCE_ISLAMIC, TARGET_ISLAMIC);
    console.log(`[prepare-flavor] Materialized Islamic routes at app/(islamic)/`);
  } else {
    rmrf(TARGET_ISLAMIC);
    console.log(`[prepare-flavor] Generic build: removed app/(islamic)/ if present`);
  }
}

main();
