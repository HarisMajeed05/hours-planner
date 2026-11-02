// everything I save lives on the phone, nothing leaves it except the Groq calls.
// all changes go through mutate() so the app, the geofence task and the widget never overwrite each other
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { migrateDay, purgeOld } from './logic';

const KEY = 'hours-planner:v1';
const SECRET = 'groq-key';

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

// fn gets the current state and returns the new one
export function mutate(fn) {
  queue = queue
    .then(async () => {
      const cur = await read();
      const next = fn(cur) ?? cur;
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
