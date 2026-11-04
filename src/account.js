// the cloud account: sign in and out, profile, avatar and syncing my hours through my own Supabase project.
// the phone stays the main copy, the cloud is a second copy I can restore from after a reinstall or on a new phone
import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { mergeStates, pickSync, purgeOld } from './logic';
import { DEFAULTS, mutate, read, updateSettings } from './store';

const CFG = 'hours-planner:cloud';
const LAST = 'hours-planner:cloud-last';

// run once in the Supabase SQL editor. every table is locked to its owner with row level security
export const SETUP_SQL = `-- Hours Planner cloud setup. Paste this into Supabase > SQL Editor > Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.backups enable row level security;

drop policy if exists "profiles select own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles delete own" on public.profiles;
create policy "profiles select own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles delete own" on public.profiles for delete to authenticated using (auth.uid() = id);

drop policy if exists "backups select own" on public.backups;
drop policy if exists "backups insert own" on public.backups;
drop policy if exists "backups update own" on public.backups;
drop policy if exists "backups delete own" on public.backups;
create policy "backups select own" on public.backups for select to authenticated using (auth.uid() = user_id);
create policy "backups insert own" on public.backups for insert to authenticated with check (auth.uid() = user_id);
create policy "backups update own" on public.backups for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "backups delete own" on public.backups for delete to authenticated using (auth.uid() = user_id);

-- profile pictures: a public bucket, and everyone can only write inside their own folder
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

drop policy if exists "avatars insert own" on storage.objects;
drop policy if exists "avatars update own" on storage.objects;
drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars insert own" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
`;

// ---------- state the screens read ----------

const S = { ready: false, configured: false, user: null, syncing: false, last: 0, error: '' };
const subs = new Set();
const emit = () => subs.forEach((f) => f({ ...S }));

export function useAccount() {
  const [a, setA] = useState({ ...S });
  useEffect(() => {
    subs.add(setA);
    setA({ ...S });
    init();
    return () => subs.delete(setA);
  }, []);
  return a;
}

// ---------- the client ----------

let client = null;
let sig = '';
let authSub = null;
let hooked = false;

export async function getConfig() {
  try {
    const raw = await AsyncStorage.getItem(CFG);
    return raw ? JSON.parse(raw) : { url: '', key: '' };
  } catch {
    return { url: '', key: '' };
  }
}

async function getClient() {
  const cfg = await getConfig();
  if (!cfg.url || !cfg.key) return null;
  const s = `${cfg.url}|${cfg.key}`;
  if (!client || s !== sig) {
    client = createClient(cfg.url, cfg.key, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } });
    sig = s;
  }
  return client;
}

async function init() {
  if (S.ready) return;
  S.ready = true;
  if (!hooked) {
    hooked = true;
    // refresh the login only while the app is open
    AppState.addEventListener('change', (st) => {
      if (!client) return;
      if (st === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  }
  const c = await getClient();
  S.configured = !!c;
  S.last = Number(await AsyncStorage.getItem(LAST)) || 0;
  authSub?.unsubscribe?.();
  authSub = null;
  if (c) {
    const { data } = await c.auth.getSession();
    S.user = data?.session?.user ?? null;
    authSub = c.auth.onAuthStateChange((_e, session) => {
      S.user = session?.user ?? null;
      emit();
    }).data.subscription;
  } else {
    S.user = null;
  }
  emit();
}

export async function saveConfig({ url, key }) {
  const u = String(url).trim().replace(/\/+$/, '');
  const k = String(key).trim();
  if (!/^https:\/\/[^\s/]+\.[^\s/]+$/.test(u)) throw new Error('The project URL should look like https://abcdefgh.supabase.co');
  if (k.length < 20) throw new Error('That key looks too short. Copy the whole anon or publishable key.');
  await AsyncStorage.setItem(CFG, JSON.stringify({ url: u, key: k }));
  client = null;
  S.ready = false;
  await init();
}

// a readable message for the usual failures
const friendly = (e) => {
  const m = String(e?.message ?? e ?? '');
  if (/invalid login credentials/i.test(m)) return new Error('Wrong email or password.');
  if (/already registered|already been registered/i.test(m)) return new Error('That email already has an account. Sign in instead.');
  if (/email not confirmed/i.test(m)) return new Error('Confirm your email first. Check your inbox, then sign in.');
  if (/network request failed|failed to fetch|fetch failed|timed out/i.test(m)) return new Error('No internet connection.');
  if (/rate limit|too many|security purposes/i.test(m)) return new Error('Too many tries. Wait a minute and try again.');
  if (/token has expired|invalid.*(token|otp)|otp.*(expired|invalid)/i.test(m)) return new Error('That code is wrong or has expired.');
  if (/password should be at least|weak password/i.test(m)) return new Error('That password is too weak. Use a longer one.');
  if (/invalid api key|no api key|apikey/i.test(m)) return new Error('The project key is wrong. Check it in Cloud setup.');
  if (/row-level security/i.test(m)) return new Error('The cloud refused that. Run the setup SQL again and sign in again.');
  return new Error(m || 'Something went wrong.');
};

async function need() {
  await init();
  const c = await getClient();
  if (!c) throw new Error('Set up your cloud project first.');
  return c;
}
async function needUser() {
  const c = await need();
  const { data } = await c.auth.getSession();
  const u = data?.session?.user;
  if (!u) throw new Error('Sign in first.');
  return { c, u };
}
// the signed in user, or null when there is none. never throws
async function softUser() {
  try {
    return await needUser();
  } catch {
    return null;
  }
}

// tells me if the url and key work and the setup SQL has been run
export async function testCloud() {
  const c = await need();
  const { error } = await c.from('profiles').select('id').limit(1);
  if (!error) return 'ok';
  const m = `${error.code ?? ''} ${error.message ?? ''}`;
  if (/42P01|PGRST205|does not exist|schema cache/i.test(m)) throw new Error('Connected, but the tables are missing. Run the setup SQL in Supabase first.');
  throw friendly(error);
}

// ---------- signing in and out ----------

export async function signUp({ email, password, name }) {
  const c = await need();
  const { data, error } = await c.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
  if (error) throw friendly(error);
  if (!data?.session) return { needsConfirm: true }; // the project asks for a confirmed email first
  if (name.trim()) await updateSettings({ name: name.trim() });
  await afterSignIn();
  return { needsConfirm: false };
}

export async function signIn({ email, password }) {
  const c = await need();
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw friendly(error);
  await afterSignIn();
}

// bring the profile down (or create it from what is on this phone), then sync the hours
async function afterSignIn() {
  await pullProfile().catch(() => {});
  await syncNow().catch(() => {});
}

export async function signOut({ clear = false } = {}) {
  const c = await getClient();
  if (c) {
    const { error } = await c.auth.signOut();
    if (error) await c.auth.signOut({ scope: 'local' }); // no network: at least forget the login on this phone
  }
  S.user = null;
  S.error = '';
  emit();
  if (clear) {
    // for a shared phone: remove my hours and profile from this device too. the cloud copy stays
    await mutate((st) => ({ settings: { ...DEFAULTS, onboarded: true, theme: st.settings.theme, sounds: st.settings.sounds }, days: {} }), { stamp: false });
  }
}

export async function sendResetCode(email) {
  const c = await need();
  const { error } = await c.auth.resetPasswordForEmail(email.trim());
  if (error) throw friendly(error);
}

// the reset email carries a 6 digit code, entering it signs me in and sets the new password
export async function resetWithCode({ email, code, password }) {
  const c = await need();
  const { error } = await c.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
  if (error) throw friendly(error);
  const { error: e2 } = await c.auth.updateUser({ password });
  if (e2) throw friendly(e2);
  await afterSignIn();
}

export async function changePassword(password) {
  const { c } = await needUser();
  const { error } = await c.auth.updateUser({ password });
  if (error) throw friendly(error);
}

// ---------- profile and avatar ----------

const avatarUrlOf = (avatar) => (avatar?.type === 'preset' ? `preset:${avatar.id}` : (avatar?.url ?? null));

const avatarFromUrl = (url, current) => {
  if (url.startsWith('preset:')) return { type: 'preset', id: Number(url.slice(7)) || 0 };
  if (current?.type === 'photo' && current.url === url) return current; // already have the picture on this phone
  return { type: 'url', url };
};

async function pushProfile(name, avatar) {
  const { c, u } = await needUser();
  const { error } = await c.from('profiles').upsert({ id: u.id, name: name ?? '', avatar_url: avatarUrlOf(avatar), updated_at: new Date().toISOString() });
  if (error) throw friendly(error);
}

export async function pullProfile() {
  const { c, u } = await needUser();
  const { data: row, error } = await c.from('profiles').select('name, avatar_url').eq('id', u.id).maybeSingle();
  if (error) throw friendly(error);
  const { settings } = await read();
  if (!row) return pushProfile(settings.name, settings.avatar); // first time on this account
  const patch = {};
  if (row.name) patch.name = row.name;
  if (row.avatar_url) patch.avatar = avatarFromUrl(row.avatar_url, settings.avatar);
  if (Object.keys(patch).length) await updateSettings(patch);
}

// these save on the phone first, so they work offline. if the cloud part fails the error is thrown after the local save
export async function setName(name) {
  await updateSettings({ name: name.trim() });
  if (await softUser()) await pushProfile(name.trim(), (await read()).settings.avatar);
}

export async function setAvatarPreset(id) {
  await updateSettings({ avatar: { type: 'preset', id } });
  if (await softUser()) await pushProfile((await read()).settings.name, { type: 'preset', id });
}

// 62 characters in, bytes out, for the upload
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function b64ToBytes(b64) {
  const clean = String(b64).replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map((j) => (i + j < clean.length ? B64.indexOf(clean[i + j]) : -1));
    if (p < out.length) out[p++] = (n[0] << 2) | (n[1] >> 4);
    if (n[2] >= 0 && p < out.length) out[p++] = ((n[1] & 15) << 4) | (n[2] >> 2);
    if (n[3] >= 0 && p < out.length) out[p++] = ((n[2] & 3) << 6) | n[3];
  }
  return out;
}

export async function setAvatarPhoto(base64) {
  const uri = `data:image/jpeg;base64,${base64}`;
  const who = await softUser();
  let url = null;
  if (who) {
    const path = `${who.u.id}/avatar.jpg`;
    const { error } = await who.c.storage.from('avatars').upload(path, b64ToBytes(base64), { contentType: 'image/jpeg', upsert: true });
    if (error) {
      await updateSettings({ avatar: { type: 'photo', uri } }); // keep it on this phone at least
      throw friendly(error);
    }
    url = `${who.c.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  }
  const avatar = { type: 'photo', uri, ...(url ? { url } : {}) };
  await updateSettings({ avatar });
  if (who) await pushProfile((await read()).settings.name, avatar);
}

// ---------- syncing ----------

const deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
};

// pulls the cloud copy, merges it with this phone, saves the result on both sides.
// replace: true makes this phone the truth (used after restoring a backup)
export async function syncNow({ replace = false } = {}) {
  await init();
  if (S.syncing) return 'busy';
  const who = await softUser();
  if (!who) return 'skip';
  const { c, u } = who;
  S.syncing = true;
  S.error = '';
  emit();
  try {
    const { settings, days } = await read();
    const { data: row, error } = await c.from('backups').select('data').eq('user_id', u.id).maybeSingle();
    if (error) throw friendly(error);
    const remote = row?.data ?? {};
    const local = { days, settings: pickSync(settings) };
    const m = replace ? local : mergeStates(local, remote);
    const merged = { days: purgeOld(m.days, new Date()), settings: m.settings };
    if (!deepEqual(local, merged)) await mutate((st) => ({ ...st, days: merged.days, settings: { ...st.settings, ...merged.settings } }), { stamp: false });
    if (replace || !deepEqual({ days: remote.days ?? {}, settings: remote.settings ?? {} }, merged)) {
      const { error: e2 } = await c.from('backups').upsert({ user_id: u.id, data: merged, updated_at: new Date().toISOString() });
      if (e2) throw friendly(e2);
    }
    S.last = Date.now();
    await AsyncStorage.setItem(LAST, String(S.last));
    return 'ok';
  } catch (e) {
    S.error = e.message;
    throw e;
  } finally {
    S.syncing = false;
    emit();
  }
}

// removes everything I stored in the cloud. the account itself is deleted from the Supabase dashboard
export async function deleteCloudData() {
  const { c, u } = await needUser();
  for (const r of [c.from('backups').delete().eq('user_id', u.id), c.from('profiles').delete().eq('id', u.id)]) {
    const { error } = await r;
    if (error) throw friendly(error);
  }
  await c.storage.from('avatars').remove([`${u.id}/avatar.jpg`]);
  S.last = 0;
  await AsyncStorage.removeItem(LAST);
  emit();
}
