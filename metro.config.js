// Polyfill for Node 18 — Expo SDK 54's Metro uses Array.prototype.toReversed
// which only exists on Node 20+. Safe to remove when moving to Node 20.
if (!Array.prototype.toReversed) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.toReversed = function () {
    return [...this].reverse();
  };
}

// Metro config for MoneyFlow dual-flavor build.
//
// Layers 2 & 3 of the tree-shake pipeline:
//
//   Layer 2 — resolver.resolveRequest returns {type:'empty'} for any import of
//   @/features/islamic/* or app-islamic/* when APP_FLAVOR !== 'islamic'. This
//   catches imports that Babel's branch-elimination (Layer 1) missed — e.g.,
//   dynamic require() or string-literal module paths.
//
//   Layer 3 — resolver.blockList hides features/islamic/** and app-islamic/**
//   from Metro's file-system resolver entirely in generic builds. Final net.
//
// Layer 4 lives in scripts/prepare-flavor.js (swaps app-islamic → app routes
// because Expo Router enumerates the app/ directory structurally at build time,
// independent of Metro resolvers).

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const isIslamic = process.env.APP_FLAVOR === 'islamic';

if (!isIslamic) {
  // Layer 2 — empty-module resolution for any stray islamic import.
  const originalResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (
      moduleName.startsWith('@/features/islamic') ||
      moduleName.includes('/features/islamic/') ||
      moduleName.startsWith('@/app-islamic') ||
      moduleName.includes('/app-islamic/')
    ) {
      return { type: 'empty' };
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };

  // Layer 3 — blockList hides the directories from the resolver entirely.
  const islamicBlock = [
    /features\/islamic\//,
    /app-islamic\//,
  ];
  config.resolver.blockList = config.resolver.blockList
    ? [].concat(config.resolver.blockList, islamicBlock)
    : islamicBlock;
}

module.exports = config;
