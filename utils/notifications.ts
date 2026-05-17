// Phase 10t — Bill reminders via expo-notifications.
//
// Schedules one local notification per active expense-type recurring item,
// firing `dayOfMonth - reminderLeadDays` of every month at 09:00 local time.
// Income recurring items aren't scheduled (you don't need a heads-up that
// your salary will arrive).
//
// Lifecycle:
//   - upsertRecurring() / deleteRecurring() / setReminderLeadDays() /
//     setRemindersEnabled() all call rescheduleAllReminders(), which wipes
//     the previously-scheduled set (by tag) and re-emits the current state.
//   - On app boot, rescheduleAllReminders() runs once so the user's view
//     of "what's scheduled" matches what's actually queued on the device.
//   - Permission is requested lazily the first time the user flips the
//     master toggle on — never on app launch.
//
// Why local notifications: this entire feature is on-device. No push server,
// no token registration, no Sentry of notification deliveries. iOS and
// Android both allow scheduling ~64+ pending local notifications, far more
// than the recurring-items table will ever hold for a personal-finance app.

import { Platform } from 'react-native';
import { kv } from '@/utils/kv';
import { t as i18nT } from '@/utils/i18n';

/** MMKV keys owned by this module. */
const KV_ENABLED = 'remindersEnabled';
const KV_LEAD_DAYS = 'reminderLeadDays';

/** Default lead time, per the plan: 2 days before the bill's day-of-month. */
export const DEFAULT_LEAD_DAYS = 2;

/** Identifier prefix for all reminders we schedule, so we can scan-and-cancel
 *  cleanly without nuking unrelated notifications that might land here later. */
const ID_PREFIX = 'bill-reminder:';

export function getRemindersEnabled(): boolean {
  return kv.getBool(KV_ENABLED, false);
}

export function getReminderLeadDays(): number {
  const raw = kv.get(KV_LEAD_DAYS);
  if (!raw) return DEFAULT_LEAD_DAYS;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 7) return DEFAULT_LEAD_DAYS;
  return n;
}

/** Lazy-require expo-notifications so the dev test runner (which doesn't link
 *  native modules) doesn't crash importing this file. Returns null if the
 *  module isn't available — every public function in this file no-ops in
 *  that case rather than throwing. */
type NotificationsModule = typeof import('expo-notifications');
function getNotifications(): NotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/** Ask the user once. Caches the answer in MMKV so we don't re-prompt on
 *  every app launch. Returns `granted | denied | undetermined`. */
export async function ensureNotificationPermission(): Promise<'granted' | 'denied'> {
  const N = getNotifications();
  if (!N) return 'denied';
  const current = await N.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const res = await N.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return res.granted ? 'granted' : 'denied';
}

/** Compute the next firing date for a given dayOfMonth + lead-days offset.
 *  Pinned to 09:00 local time. If the resulting date is already past this
 *  month, roll forward to next month. */
export function nextFireDate(
  dayOfMonth: number,
  leadDays: number,
  now: Date = new Date(),
): Date {
  // Reminder date = bill date − lead. Handle overflow into the prior month
  // naturally: Date(y, m, 1 − 1) → last day of prev month, which is fine.
  const billDay = Math.min(Math.max(dayOfMonth, 1), 31);
  const lead = Math.max(0, leadDays);
  const candidate = new Date(now.getFullYear(), now.getMonth(), billDay - lead, 9, 0, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate;
}

interface ReminderRow {
  id: string;          // recurring.id
  name: string;
  amount: number;
  dayOfMonth: number;
  type: 'expense' | 'income';
}

/** Cancel every reminder we previously scheduled, identified by ID prefix. */
async function cancelAllReminders(): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  const scheduled = await N.getAllScheduledNotificationsAsync();
  for (const s of scheduled) {
    if (s.identifier.startsWith(ID_PREFIX)) {
      await N.cancelScheduledNotificationAsync(s.identifier);
    }
  }
}

/** Schedule one repeating monthly local notification per active expense
 *  recurring item. Income items are skipped — a salary heads-up isn't
 *  useful and would inflate the noise floor for actual bill alerts. */
export async function rescheduleAllReminders(rows: ReminderRow[]): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  await cancelAllReminders();
  if (!getRemindersEnabled()) return;
  const perm = await N.getPermissionsAsync();
  if (!perm.granted) return;

  const lead = getReminderLeadDays();
  for (const r of rows) {
    if (r.type !== 'expense') continue;
    const fire = nextFireDate(r.dayOfMonth, lead);
    try {
      await N.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${r.id}`,
        content: {
          title: r.name,
          body: i18nT('plan.audit.dueIn', { n: lead }),
          data: { recurringId: r.id, type: 'bill-reminder' },
        },
        // DATE trigger fires once at the given time; we'll reschedule next
        // month either at boot or via the upsert/delete hooks. Monthly
        // repeats via calendar triggers behave inconsistently across iOS/
        // Android, so we keep this explicit and roll forward ourselves.
        trigger: {
          type: 'date' as const,
          date: fire,
          channelId: Platform.OS === 'android' ? 'bill-reminders' : undefined,
        } as never,
      });
    } catch {
      // Skip silently — one bad row shouldn't kill the whole reschedule.
    }
  }
}

/** Android requires a channel before scheduling. iOS ignores `channelId`.
 *  Idempotent: safe to call on every boot. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const N = getNotifications();
  if (!N) return;
  try {
    await N.setNotificationChannelAsync('bill-reminders', {
      name: 'Bill reminders',
      importance: N.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
    });
  } catch {
    /* swallow — channel already exists or permission API unavailable */
  }
}

export async function setRemindersEnabled(
  enabled: boolean,
  rows: ReminderRow[],
): Promise<'granted' | 'denied'> {
  if (enabled) {
    const perm = await ensureNotificationPermission();
    if (perm !== 'granted') {
      kv.setBool(KV_ENABLED, false);
      return 'denied';
    }
  }
  kv.setBool(KV_ENABLED, enabled);
  await ensureAndroidChannel();
  await rescheduleAllReminders(rows);
  return enabled ? 'granted' : 'denied';
}

export async function setReminderLeadDays(
  days: number,
  rows: ReminderRow[],
): Promise<void> {
  kv.set(KV_LEAD_DAYS, String(days));
  await rescheduleAllReminders(rows);
}
