// things that touch the phone itself: the office geofence, my calendar and the fingerprint.
// this file is imported from index.js so the geofence task exists even when the app starts in the background
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar/legacy';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { checkOutDay, dateKey, fmtTime, isLive, resumeDay, weightOf } from './logic';
import { notifyNow } from './notify';
import { read, updateDay } from './store';

export const GEO_TASK = 'office-geofence';
const MERGE_GAP = 5 * 60000; // leaving and coming back within 5 minutes counts as one visit
const SETTLE = 90000; // ignore the event Android fires right after I register the fence
const SIG_KEY = 'hours-planner:geo';

// ---------- office geofence ----------

async function onGeofence(kind) {
  const { settings, days } = await read();
  if (settings.geo === 'off') return;
  const now = new Date();
  const k = dateKey(now);
  const d = days[k];
  if (now.getHours() < 5) return; // nothing useful happens in the middle of the night
  if (weightOf(k, d) <= 0 || d?.done) return; // weekend, leave, holiday or day already finished

  const meta = JSON.parse((await AsyncStorage.getItem(SIG_KEY)) ?? '{}');
  if (meta.at && now.getTime() - meta.at < SETTLE) return;

  const live = isLive(d);
  const t = fmtTime(now.getTime());
  if (kind === 'enter' && !live) {
    if (settings.geo === 'auto') {
      await updateDay(k, (x) => resumeDay(x, now.getTime(), MERGE_GAP));
      await notifyNow('Checked in automatically', `You arrived at ${t}. Open the app if that is wrong.`);
    } else {
      await notifyNow('You are at the office', 'Check in now?', 'checkin');
    }
  } else if (kind === 'exit' && live) {
    if (settings.geo === 'auto') {
      await updateDay(k, (x) => checkOutDay(x, now.getTime()));
      await notifyNow('Checked out automatically', `You left at ${t}. Open the app if that is wrong.`);
    } else {
      await notifyNow('Leaving the office?', 'Check out now?', 'checkout');
    }
  }
}

TaskManager.defineTask(GEO_TASK, async ({ data, error }) => {
  if (error || !data) return;
  try {
    await onGeofence(data.eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit');
  } catch {}
});

// I stand at the office and tap save. returns the spot and throws a readable error if a permission is missing
export async function saveOfficeHere() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new Error('Location permission was denied.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) throw new Error('Pick "Allow all the time" for location, otherwise the phone cannot notice the office in the background.');
  return { lat: pos.coords.latitude, lon: pos.coords.longitude };
}

// start or stop the fence to match the settings. it only restarts when the spot or radius changed
export async function syncGeofence(settings) {
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
