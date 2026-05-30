// Where the legal pages are hosted. Source files live on the `main`
// branch of github.com/aqsaqal/moneyapp under /docs, rendered by
// GitHub Pages with the `jekyll-theme-minimal` theme.
//
// Two flavors → two sets of URLs. The Amanah pages add Islamic-feature
// disclosures (zakat calculator, nisab refresh provider, halal tagging,
// sadaqa privacy guarantees) that don't apply to the generic Flow build.
// Babel inlines process.env.APP_FLAVOR so the unused branch DCE's per
// build.
//
// The App Store and Play Store store-listing entries MUST match the
// URL surfaced here for the corresponding flavor.

const IS_ISLAMIC = process.env.APP_FLAVOR === 'islamic';
const BASE = 'https://aqsaqal.github.io/moneyapp';

export const PRIVACY_POLICY_URL = IS_ISLAMIC
  ? `${BASE}/amanah/privacy.html`
  : `${BASE}/flow/privacy.html`;

export const TERMS_URL = IS_ISLAMIC
  ? `${BASE}/amanah/terms.html`
  : `${BASE}/flow/terms.html`;

export const SUPPORT_EMAIL = 'ak.saken@gmail.com';
