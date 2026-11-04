// things that touch the phone itself: the office detection, my calendar and the fingerprint.
// this file is imported from index.js so the tasks exist even when the app starts in the background
//
// automatic check in/out works with two things at once:
//  1. a geofence, the phone tells me the moment I cross the office edge (fast, but Android can skip it)
//  2. a check every 15 minutes or so, and every time I open the app, that looks at where I am and fixes anything the geofence missed
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as Calendar from 'expo-calendar/legacy';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { autoAction, checkOutDay, dateKey, fmtTime, haversine, isLive, resumeDay, undoAuto, weightOf } from './logic';
import { notifyNow } from './notify';
import { read, updateDay } from './store';

export const GEO_TASK = 'office-geofence';
export const CHECK_TASK = 'office-check';
const MERGE_GAP = 5 * 60000; // leaving and coming back within 5 minutes counts as one visit
const SETTLE = 90000; // ignore the event Android fires right after I register the fence
const SIG_KEY = 'hours-planner:geo';

// ---------- doing the automatic action ----------

// each automatic action sends a notification with an Undo button that works without opening the app
async function record(kind, now) {
  const k = dateKey(now);
  const at = now.getTime();
  const t = fmtTime(at);
  if (kind === 'in') {
    await updateDay(k, (x) => resumeDay(x, at, MERGE_GAP));
    await notifyNow('auto', 'Checked in automatically', `You arrived at ${t}.`, { category: 'autoundo', data: { undo: { kind: 'in', day: k, at } } });
  } else {
    await updateDay(k, (x) => checkOutDay(x, at, 'auto'));
    await notifyNow('auto', 'Checked out automatically', `You left at ${t}.`, { category: 'autoundo', data: { undo: { kind: 'out', day: k, at } } });
  }
}

// the Undo button. safe to run twice, undoAuto only acts on the exact record it was made for
export async function undoFromNotification(data) {
  const u = data?.undo;
  if (!u?.day || !u.kind) return false;
  const before = (await read()).days[u.day];
  const after = undoAuto(before, u.kind, u.at);
  if (after === before) return false;
  await updateDay(u.day, (d) => undoAuto(d, u.kind, u.at));
  await notifyNow('auto', 'Undone', u.kind === 'in' ? 'The automatic check in was removed. Auto check in is paused for today.' : 'You are checked in again. Auto check in is paused for today.');
  return true;
}

// ---------- 1. the geofence ----------

async function onGeofence(kind) {
  const { settings, days } = await read();
  if (settings.geo === 'off') return;
  const now = new Date();
  const k = dateKey(now);
  const d = days[k];
  if (now.getHours() < 5) return; // nothing useful happens in the middle of the night
  if (weightOf(k, d) <= 0 || d?.done) return; // weekend, leave, holiday or day already finished

  if (settings.geo === 'auto' && d?.noAuto) return; // I undid an automatic action today, so it stays out of the way
  const meta = JSON.parse((await AsyncStorage.getItem(SIG_KEY)) ?? '{}');
  if (meta.at && now.getTime() - meta.at < SETTLE) return;

  const live = isLive(d);
  if (kind === 'enter' && !live) {
    if (settings.geo === 'auto') await record('in', now);
    else await notifyNow('auto', 'You are at the office', 'Check in now?', { category: 'checkin' });
  } else if (kind === 'exit' && live) {
    if (settings.geo === 'auto') await record('out', now);
    else await notifyNow('auto', 'Leaving the office?', 'Check out now?', { category: 'checkout' });
  }
}

TaskManager.defineTask(GEO_TASK, async ({ data, error }) => {
  if (error || !data) return;
  try {
    await onGeofence(data.eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit');
  } catch {}
});

// the Undo button runs here when the app is closed, the foreground case is handled in App.js
export const NOTIF_TASK = 'notification-actions';
TaskManager.defineTask(NOTIF_TASK, async ({ data, error }) => {
  if (error || !data || !('actionIdentifier' in data)) return;
  if (data.actionIdentifier === 'undo-auto') {
    try {
      await undoFromNotification(data.notification?.request?.content?.data);
    } catch {}
  }
});
Notifications.registerTaskAsync(NOTIF_TASK).catch(() => {});

// ---------- 2. look at where I am ----------

// a fresh fix if the phone can give one quickly, otherwise the last one it knows (up to 10 minutes old)
async function here() {
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('no fix')), 20000)),
    ]);
  } catch {
    return Location.getLastKnownPositionAsync({ maxAge: 10 * 60000 });
  }
}

// metres to the office and whether I am inside, or null when the phone has no fix. used by the settings screen too
export async function officeStatus(settings) {
  if (!settings.office) return null;
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return null;
  const pos = await here();
  if (!pos) return null;
  const dist = haversine(pos.coords.latitude, pos.coords.longitude, settings.office.lat, settings.office.lon);
  return { dist, inside: dist <= Math.max(100, Number(settings.radius) || 150) };
}

// compares my position with the office and checks me in or out if the automatic mode is on.
// this catches the cases the geofence misses, like turning the mode on while I am already at my desk
export async function reconcile() {
  const { settings, days } = await read();
  if (settings.geo !== 'auto' || !settings.office) return 'skip';
  const fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) return 'skip';
  const pos = await here();
  if (!pos) return 'no fix';
  const now = new Date();
  const k = dateKey(now);
  const dist = haversine(pos.coords.latitude, pos.coords.longitude, settings.office.lat, settings.office.lon);
  const act = autoAction({ dist, radius: Math.max(100, Number(settings.radius) || 150), day: days[k], weight: weightOf(k, days[k]), hour: now.getHours() });
  if (act) await record(act, now);
  return act ?? 'ok';
}

TaskManager.defineTask(CHECK_TASK, async () => {
  try {
    await reconcile();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// ---------- turning it on ----------

// I stand at the office and tap save. returns the spot and throws a readable error if a permission is missing
export async function saveOfficeHere() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new Error('Location permission was denied.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) throw new Error('Pick "Allow all the time" for location, otherwise the phone cannot notice the office in the background.');
  return { lat: pos.coords.latitude, lon: pos.coords.longitude };
}

// checks everything the automatic mode needs. the office spot is never saved silently, because saving it at home would break it
export async function enableAuto(settings) {
  if (!settings.office) throw new Error('Save your office spot first. Stand at the office and use "Save my current spot".');
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new Error('Location permission was denied.');
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) throw new Error('Pick "Allow all the time" for location, otherwise it cannot work with the screen off.');
  return { geo: 'auto' };
}

async function startFence(settings) {
  const started = await Location.hasStartedGeofencingAsync(GEO_TASK).catch(() => false);
  if (settings.geo === 'off' || !settings.office) {
    if (started) await Location.stopGeofencingAsync(GEO_TASK);
    return 'off';
  }
  const bg = await Location.getBackgroundPermissionsAsync();
  if (!bg.granted) return 'permission';

  const radius = Math.max(100, Number(settings.radius) || 150);
  const sig = `${settings.office.lat},${settings.office.lon},${radius}`;
  const meta = JSON.parse((await AsyncStorage.getItem(SIG_KEY)) ?? '{}');
  if (started && meta.sig === sig) return 'on';

  await Location.startGeofencingAsync(GEO_TASK, [
    { identifier: 'office', latitude: settings.office.lat, longitude: settings.office.lon, radius, notifyOnEnter: true, notifyOnExit: true },
  ]);
  await AsyncStorage.setItem(SIG_KEY, JSON.stringify({ sig, at: Date.now() }));
  return 'on';
}

// the periodic check only runs while the automatic mode is on
async function syncCheck(settings) {
  const want = settings.geo === 'auto' && !!settings.office;
  const registered = await TaskManager.isTaskRegisteredAsync(CHECK_TASK).catch(() => false);
  if (want && !registered) await BackgroundTask.registerTaskAsync(CHECK_TASK, { minimumInterval: 15 });
  if (!want && registered) await BackgroundTask.unregisterTaskAsync(CHECK_TASK);
}

// start or stop both pieces to match the settings. the fence only restarts when the spot or radius changed
export async function syncGeofence(settings) {
  const fence = await startFence(settings);
  await syncCheck(settings).catch(() => {});
  return fence;
}

// ---------- calendar ----------

// today's timed events, trimmed down to what the planner needs
export async function todaysMeetings() {
  const perm = await Calendar.requestCalendarPermissionsAsync();
  if (!perm.granted) throw new Error('Calendar permission was denied.');
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  const events = await Calendar.getEventsAsync(
    cals.map((c) => c.id),
    start,
    end
  );
  return events
    .filter((e) => !e.allDay)
    .map((e) => {
      const a = new Date(e.startDate).getTime();
      const b = new Date(e.endDate).getTime();
      return { a, title: String(e.title || 'Busy').slice(0, 60), start: fmtTime(a), end: fmtTime(b), minutes: Math.max(0, Math.round((b - a) / 60000)) };
    })
    .sort((x, y) => x.a - y.a)
    .slice(0, 12)
    .map(({ a, ...rest }) => rest);
}

// ---------- fingerprint ----------

export async function biometricReady() {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function unlockWithBiometrics() {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Open Hours Planner' });
  return r.success;
}
