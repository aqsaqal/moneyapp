// Flow Pro — one-time unlock, bought straight from the App Store / Google
// Play (expo-iap, no server, no account). See utils/pro.ts for the gates.

import { IS_ISLAMIC } from './flavor';

/** Non-consumable product id, created in both consoles with this exact id. */
export const PRO_PRODUCT_ID = IS_ISLAMIC ? 'amanah_pro_lifetime' : 'flow_pro_lifetime';
/** Shown until the store answers with the buyer's own currency. */
export const PRO_FALLBACK_PRICE = '$9.99';

/** Free tier limits. Profiles: the Demo profile does not count. */
export const FREE_PROFILE_LIMIT = 2;
export const FREE_EVENT_LIMIT = 1;

export type ProFeature = 'themes' | 'events' | 'split' | 'pdf' | 'profiles';
