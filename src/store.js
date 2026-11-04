// everything I save lives on the phone, nothing leaves it except the Groq calls.
// all changes go through mutate() so the app, the geofence task and the widget never overwrite each other
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { SYNC_KEYS, migrateDay, purgeOld } from './logic';

const KEY = 'hours-planner:v1';
const SECRET = 'groq-key';

// sound, vibration and priority per kind of notification. alarms are always top priority
export const DEFAULT_SOUNDS = {
  alarm: { sound: 'classic', vibrate: true },
  reminder: { sound: 'soft', vibrate: true, priority: 'high' },
  auto: { sound: 'chime', vibrate: true, priority: 'high' },
};

export const DEFAULTS = {
  name: '', // what the app calls me
  model: 'openai/gpt-oss-20b',
  target: 198, // hours I owe per month
  margin: 4, // hours I am allowed to fall short by
  officialStart: '09:00',
  officialEnd: '18:00',
  plannerAt: '08:30', // weekday nudge to tell the app my workload
  alarms: true,
  theme: 'system', // system | dark | light
  lock: false, // fingerprint to open the app
  geo: 'off', // off | prompt | auto
  office: null, // { lat, lon } saved while standing at the office
  radius: 150, // metres around the office
  calendar: false, // let the planner read today's meetings
  sounds: DEFAULT_SOUNDS, // sound, vibration and priority for alarms, reminders and automatic check ins
  avatar: null, // { type: 'photo' | 'url' | 'preset', ... }
  bannerDismissed: false, // the sign in suggestion on the Today screen
  onboarded: false,
};

// the Groq key sits in secure storage, never in the normal settings blob
export const getGroqKey = async () => {
  try {
    return (await SecureStore.getItemAsync(SECRET)) ?? '';
  } catch {
    return '';
  }
};
export const setGroqKey = async (v) => {
  if (v) await SecureStore.setItemAsync(SECRET, v);
  else await SecureStore.deleteItemAsync(SECRET);
};

export async function read() {
  let saved = {};
  try {
    const raw = await AsyncStorage.getItem(KEY);
    saved = raw ? JSON.parse(raw) : {};
  } catch {
    saved = {};
  }
  const settings = { ...DEFAULTS, ...(saved.settings ?? {}) };
  settings.sounds = Object.fromEntries(Object.keys(DEFAULT_SOUNDS).map((k) => [k, { ...DEFAULT_SOUNDS[k], ...(saved.settings?.sounds?.[k] ?? {}) }]));

  // the first version kept the key in plain storage, move it over once
  if (settings.groqKey) {
    try {
      await setGroqKey(settings.groqKey);
    } catch {}
    delete settings.groqKey;
  }

  const days = {};
  for (const [k, v] of Object.entries(saved.days ?? {})) {
    const d = migrateDay(v);
    if (d) days[k] = d;
  }
  return { settings, days: purgeOld(days, new Date()) };
}

let queue = Promise.resolve();
const listeners = new Set();
const afterWrite = [];

export const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
// the widget registers here so it refreshes after every change
export const onWrite = (cb) => afterWrite.push(cb);

// every day I change gets a "u" stamp and the synced settings get "su", that is how a merge knows which copy is newer.
// the sync itself passes stamp: false so merging never makes old data look new
const dayStamp = (d) => (d ? JSON.stringify({ ...d, u: undefined }) : '');
const setSig = (st) => JSON.stringify(SYNC_KEYS.map((k) => st?.[k]));

// fn gets the current state and returns the new one
export function mutate(fn, { stamp = true } = {}) {
  queue = queue
    .then(async () => {
      const cur = await read();
      let next = fn(cur) ?? cur;
      if (stamp) {
        const now = Date.now();
        const days = { ...next.days };
        for (const k of Object.keys(days)) if (dayStamp(days[k]) !== dayStamp(cur.days[k])) days[k] = { ...days[k], u: now };
        next = { ...next, days };
        if (setSig(next.settings) !== setSig(cur.settings)) next = { ...next, settings: { ...next.settings, su: now } };
      }
      await AsyncStorage.setItem(KEY, JSON.stringify({ settings: next.settings, days: purgeOld(next.days, new Date()) }));
      listeners.forEach((l) => l(next));
      afterWrite.forEach((w) => {
        try {
          w(next);
        } catch {}
      });
      return next;
    })
    .catch(() => null);
  return queue;
}

export const updateDay = (key, fn) =>
  mutate((s) => ({ ...s, days: { ...s.days, [key]: fn(s.days[key] ?? {}) } }));
export const updateSettings = (patch) => mutate((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
