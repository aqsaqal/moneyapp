// Canary for Phase 1.8 tree-shake verification.
// This file must NOT appear in the generic bundle. The string below is the
// target token for `strings` / `grep` pipelines in scripts/verify-tree-shake.sh.
//
// Tokens that must be physically excluded from the generic build:
//   ZAKAT_TEST_STRING, AMANAH_CANARY, HIJRI_CANARY_MARKER
export const CANARY = 'ZAKAT_TEST_STRING';
export const AMANAH_CANARY = 'AMANAH_CANARY_UNIQUE_LITERAL';
export const HIJRI_CANARY = 'HIJRI_CANARY_MARKER';
