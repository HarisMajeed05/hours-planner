// check in / check out alarms, the hours reminders and the buttons on those notifications.
// rule I picked: an alarm rings a few times, and opening the app counts as me hearing it,
// so the next sync drops the repeats that have not fired yet
import * as Notifications from 'expo-notifications';
import { fmtH, fmtTime, parseHM } from './logic';
import { KINDS, channelFor } from './sounds';
import { read } from './store';

const T = Notifications.SchedulableTriggerInputTypes;
const RINGS = 4; // how many times one alarm rings
const RING_GAP = 2 * 60000; // 2 minutes between rings
const SOON = 1000; // ignore anything due in the next second

export function initNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// creates the channel for each kind from my current sound choices, and deletes the ones I left behind
export async function ensureChannels(settings) {
  const keep = new Set();
  for (const kind of Object.keys(KINDS)) {
    const { id, def } = channelFor(kind, settings);
    keep.add(id);
    await Notifications.setNotificationChannelAsync(id, def);
  }
  const all = (await Notifications.getNotificationChannelsAsync()) ?? [];
  for (const ch of all) {
    const mine = /^(alarm|reminder|auto)-/.test(ch.id) || ch.id === 'info-v1';
    if (mine && !keep.has(ch.id)) await Notifications.deleteNotificationChannelAsync(ch.id).catch(() => {});
  }
}

// on Android 13 the channels must exist before the permission prompt
export async function ensurePermission(settings) {
  await ensureChannels(settings ?? {});
  // buttons under the notifications. the first two open the app, Undo works without opening it
  await Notifications.setNotificationCategoryAsync('checkin', [
    { identifier: 'do-checkin', buttonTitle: 'Check in now', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync('checkout', [
    { identifier: 'do-checkout', buttonTitle: 'Check out now', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync('autoundo', [
    { identifier: 'undo-auto', buttonTitle: 'Undo', options: { opensAppToForeground: false } },
  ]);
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

// show a notification right now on the channel of this kind (alarm, reminder or auto). used by the office detection and the test button
export async function notifyNow(kind, title, body, { category, data } = {}) {
  const { settings } = await read();
  const { id, def } = channelFor(kind, settings);
  await Notifications.setNotificationChannelAsync(id, def);
  await Notifications.scheduleNotificationAsync({
    content: { title, body, ...(category ? { categoryIdentifier: category } : {}), ...(data ? { data } : {}) },
    trigger: { channelId: id },
  });
}

async function doSync({ settings, stats, now }) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.alarms) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await ensureChannels(settings);
  const ALARM_CH = channelFor('alarm', settings).id;
  const INFO_CH = channelFor('reminder', settings).id;

  const nowMs = now.getTime();
  const jobs = [];
  const info = (id, ms, title, body, cat) => {
    if (ms > nowMs + SOON) jobs.push({ id, ms, title, body, cat, ch: INFO_CH, alarm: false });
  };
  const ring = (kind, key, ms, title, body) => {
    if (ms <= nowMs + SOON) return; // already rang, and I opened the app, so it is acknowledged
    const cat = kind === 'in' ? 'checkin' : 'checkout';
    for (let i = 0; i < RINGS; i++) {
      jobs.push({ id: `${kind}|${key}|${i}`, ms: ms + i * RING_GAP, title, body, cat, ch: ALARM_CH, alarm: i === 0 });
    }
  };

  for (const r of stats.rows) {
    if (!['today', 'live', 'future'].includes(r.state) || !r.hours || !r.planOutMs) continue;
    const plan = `${fmtH(r.hours)} planned`;
    if (r.state !== 'live') {
      ring('in', r.key, r.planInMs, 'Time to check in', `Be in at ${fmtTime(r.planInMs)}. ${plan}, leave at ${fmtTime(r.planOutMs)}.`);
    }
    ring('out', r.key, r.planOutMs, 'Time to check out', `${plan} is done. Tap the biometric on the way out, then open the app.`);
    info(`pre|${r.key}|0`, r.planOutMs - 15 * 60000, '15 minutes to go', `Check out at ${fmtTime(r.planOutMs)}.`, 'checkout');

    // every 2 hours after I check in, tell me how much is done and how much is left
    if (r.state === 'live') {
      for (let k = 1; r.inMs + k * 2 * 3600000 < r.planOutMs - 20 * 60000; k++) {
        info(
          `prog|${r.key}|${k}`,
          r.inMs + k * 2 * 3600000,
          `${fmtH(2 * k)} done today`,
          `${fmtH(r.hours - 2 * k)} to go. Leave at ${fmtTime(r.planOutMs)}.`
        );
      }
    }
  }

  // weekday nudge so I tell the app my workload (1 = Sunday, so Monday to Friday is 2 to 6)
  const pm = parseHM(settings.plannerAt);
  if (pm != null) {
    for (let wd = 2; wd <= 6; wd++) {
      await Notifications.scheduleNotificationAsync({
        identifier: `plan|w|${wd}`,
        content: { title: 'Plan your day', body: 'Open the app and tell it today\'s workload.' },
        trigger: { type: T.WEEKLY, weekday: wd, hour: Math.floor(pm / 60), minute: pm % 60, channelId: INFO_CH },
      });
    }
  }

  // Android only keeps about 500 alarms per app, I stay well under that
  jobs.sort((a, b) => a.ms - b.ms);
  for (const j of jobs.slice(0, 400)) {
    await Notifications.scheduleNotificationAsync({
      identifier: j.id,
      content: { title: j.title, body: j.body, ...(j.cat ? { categoryIdentifier: j.cat } : {}) },
      trigger: {
        type: T.DATE,
        date: new Date(j.ms),
        channelId: j.ch,
        ...(j.alarm ? { delivery: 'alarmClock' } : {}),
      },
    });
  }
}

// syncs run one after another so two quick changes can't leave stale alarms behind
let chain = Promise.resolve();
export function syncNotifications(args) {
  chain = chain.then(() => doSync(args)).catch(() => {});
  return chain;
}
