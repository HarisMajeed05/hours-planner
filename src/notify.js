// check in / check out alarms, the hours reminders and the buttons on those notifications.
// rule I picked: an alarm rings a few times, and opening the app counts as me hearing it,
// so the next sync drops the repeats that have not fired yet
import * as Notifications from 'expo-notifications';
import { fmtH, fmtTime, parseHM } from './logic';

const T = Notifications.SchedulableTriggerInputTypes;
const ALARM_CH = 'alarm-v1';
const INFO_CH = 'info-v1';
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

// on Android 13 the channels must exist before the permission prompt
export async function ensurePermission() {
  await Notifications.setNotificationChannelAsync(ALARM_CH, {
    name: 'Check in and check out alarms',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'alarm.wav',
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(INFO_CH, {
    name: 'Hours reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
  // the buttons under the notification. they open the app, which then records the time
  await Notifications.setNotificationCategoryAsync('checkin', [
    { identifier: 'do-checkin', buttonTitle: 'Check in now', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync('checkout', [
    { identifier: 'do-checkout', buttonTitle: 'Check out now', options: { opensAppToForeground: true } },
  ]);
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

// show a notification right now, used by the geofence
export async function notifyNow(title, body, category) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, ...(category ? { categoryIdentifier: category } : {}) },
    trigger: { channelId: INFO_CH },
  });
}

async function doSync({ settings, stats, now }) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.alarms) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

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
