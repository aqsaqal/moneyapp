// Profile registry — each profile has its own isolated SQLite database.
//
// Why separate DBs (not a `profile_id` column on every table):
//   - Trivial isolation: queries don't need WHERE profile_id filters,
//     analytics never accidentally bleed across profiles.
//   - Cheap delete: rm one .db file removes a profile cleanly.
//   - Backup-per-profile: future export/import works without joins.
//   - Tree-shake friendly: zero new schema, zero new migrations.
//
// What's shared across profiles (lives in the global MMKV instance):
//   - locale, currency, arabicNumerals — app-wide prefs
//   - biometricEnabled — device-level lock applies to the whole app
//   - islamicPrayerMethod, islamicCity, islamicCoords — flavor settings
//
// What's per-profile (lives inside the profile's SQLite):
//   - transactions, accounts, budgets, recurring, paid_items
//   - merchant_memory (so each profile gets its own learned predictions)
//
// Active profile is stored under the global `activeProfileId` MMKV key.
// Switching profile closes the current SQLite handle and reopens against
// the new profile's DB; useVersion() listeners fire so every hook re-runs.

import { kv } from './kv';

export interface Profile {
  id: string;
  name: string;
  /** Hex color used as the profile-switcher chip background. */
  color: string;
  /** MaterialCommunityIcons name. */
  icon: string;
  createdAt: number;
}

const PROFILES_KEY = 'profiles';
const ACTIVE_KEY = 'activeProfileId';
const DEFAULT_PROFILE_ID = 'default';

export const PROFILE_COLORS = [
  '#10B981', // emerald
  '#6366F1', // indigo
  '#F59E0B', // amber
  '#EC4899', // pink
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#EF4444', // red
  '#F97316', // orange
];

export const PROFILE_ICONS = [
  'account-circle-outline',
  'briefcase-outline',
  'home-variant-outline',
  'school-outline',
  'heart-outline',
  'palette-outline',
  'food-apple-outline',
  'airplane-takeoff',
];

function readProfiles(): Profile[] {
  return kv.getJSON<Profile[]>(PROFILES_KEY) ?? [];
}

function writeProfiles(profiles: Profile[]): void {
  kv.setJSON(PROFILES_KEY, profiles);
}

/** Fired whenever the profile registry or active profile changes. Hooks
 *  subscribe via useProfilesVersion() so the UI re-renders after a switch. */
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
function bumpProfile() {
  version += 1;
  listeners.forEach((l) => l());
}
export function getProfileVersion(): number {
  return version;
}
export function onProfileChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** First-launch bootstrap. If the registry is empty, create a single
 *  "Default" profile and mark it active. The DB filename for the default
 *  profile is hardcoded to `moneyflow.db` — same as v1's filename — so
 *  existing users seamlessly migrate without losing data. */
export function ensureDefaultProfile(): Profile {
  let profiles = readProfiles();
  if (profiles.length === 0) {
    const def: Profile = {
      id: DEFAULT_PROFILE_ID,
      name: 'Personal',
      color: PROFILE_COLORS[0],
      icon: PROFILE_ICONS[0],
      createdAt: Date.now(),
    };
    profiles = [def];
    writeProfiles(profiles);
    kv.set('activeProfileId', def.id);
    return def;
  }
  if (!kv.get('activeProfileId')) {
    kv.set('activeProfileId', profiles[0].id);
  }
  return profiles.find((p) => p.id === kv.get('activeProfileId')) ?? profiles[0];
}

export function listProfiles(): Profile[] {
  return readProfiles();
}

export function getActiveProfileId(): string {
  return kv.get('activeProfileId') ?? DEFAULT_PROFILE_ID;
}

export function getActiveProfile(): Profile {
  const id = getActiveProfileId();
  const profiles = readProfiles();
  return profiles.find((p) => p.id === id) ?? ensureDefaultProfile();
}

export function switchActiveProfile(id: string): void {
  if (id === getActiveProfileId()) return;
  const profiles = readProfiles();
  if (!profiles.some((p) => p.id === id)) return;
  kv.set('activeProfileId', id);
  bumpProfile();
}

export function createProfile(input: {
  name: string;
  color?: string;
  icon?: string;
}): Profile {
  const id = `p${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const profiles = readProfiles();
  const next: Profile = {
    id,
    name: input.name.trim(),
    color: input.color ?? PROFILE_COLORS[profiles.length % PROFILE_COLORS.length],
    icon: input.icon ?? PROFILE_ICONS[profiles.length % PROFILE_ICONS.length],
    createdAt: Date.now(),
  };
  writeProfiles([...profiles, next]);
  bumpProfile();
  return next;
}

export function updateProfile(id: string, patch: Partial<Pick<Profile, 'name' | 'color' | 'icon'>>): void {
  const profiles = readProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx < 0) return;
  profiles[idx] = { ...profiles[idx], ...patch, name: patch.name?.trim() ?? profiles[idx].name };
  writeProfiles(profiles);
  bumpProfile();
}

/** Removing a profile deletes its SQLite database too; any transactions,
 *  accounts, budgets, recurring items in that profile are lost permanently.
 *  Refuses to delete the last profile — at least one must always exist. */
export function deleteProfile(id: string): { ok: boolean; reason?: string } {
  const profiles = readProfiles();
  if (profiles.length <= 1) return { ok: false, reason: 'last' };
  const target = profiles.find((p) => p.id === id);
  if (!target) return { ok: false, reason: 'not-found' };
  const remaining = profiles.filter((p) => p.id !== id);
  writeProfiles(remaining);
  // If we deleted the active profile, hop to the first remaining.
  if (getActiveProfileId() === id) {
    kv.set('activeProfileId', remaining[0].id);
  }
  bumpProfile();
  return { ok: true };
}

/** SQLite filename for a given profile. The default profile keeps the
 *  v1 filename (`moneyflow.db`) so existing installs migrate without data
 *  loss; new profiles get `moneyflow-{id}.db`. */
export function dbNameForProfile(profileId: string): string {
  if (profileId === DEFAULT_PROFILE_ID) return 'moneyflow.db';
  return `moneyflow-${profileId}.db`;
}
