// all my time and hours math lives here. no React in this file so I can test it in plain node

export const MIN_H = 6; // shortest full day I would ever want planned
export const MAX_H = 12; // longest full day I would ever want planned
export const EARLIEST_IN = 7 * 60 + 30; // never tell me to be in before 07:30
const HOUR = 3600000;

// what each kind of day is worth. w is the share of a full day it can carry
export const TYPES = {
  work: { label: 'Office day', w: 1 },
  wfh: { label: 'Work from home', w: 1 },
  half: { label: 'Half day', w: 0.5 },
  leave: { label: 'Leave', w: 0 },
  holiday: { label: 'Public holiday', w: 0 },
};

const pad = (n) => String(n).padStart(2, '0');
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};
// round up to the next quarter hour so I never end up short
const quarter = (h) => Math.ceil(h * 4 - 1e-9) / 4;
const r2 = (n) => Math.round(n * 100) / 100;

export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
// the Date for a given day at "min" minutes after midnight
export const at = (k, min) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 0, min);
};
export const isWeekday = (k) => {
  const w = parseKey(k).getDay();
  return w >= 1 && w <= 5;
};
export const minOfDay = (d) => d.getHours() * 60 + d.getMinutes();
export const fmtMin = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
export const fmtTime = (ms) => fmtMin(minOfDay(new Date(ms)));
export const fmtH = (h) => {
  const m = Math.round(Math.max(0, h) * 60);
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
};
export const parseHM = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
};

const keysOfMonth = (y, m) => {
  const n = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => dateKey(new Date(y, m, i + 1)));
};

// ---------- one day: sessions and types ----------

export const typeOf = (d) => (d?.type && TYPES[d.type] ? d.type : 'work');
export const weightOf = (k, d) => (isWeekday(k) ? TYPES[typeOf(d)].w : 0);
export const sessionsOf = (d) => d?.sessions ?? [];
export const isLive = (d) => {
  const s = sessionsOf(d);
  return s.length > 0 && s[s.length - 1].out == null;
};

// every one of these returns a new day object, nothing is changed in place.
// "by" is "manual" (me tapping) or "auto" (the office detection), only the auto ones are tagged
export function checkInDay(d, ms, by = 'manual') {
  if (isLive(d)) return d;
  return { ...d, done: false, sessions: [...sessionsOf(d), { in: ms, out: null, ...(by === 'auto' ? { inBy: 'auto' } : {}) }] };
}
export function checkOutDay(d, ms, by = 'manual') {
  if (!isLive(d)) return d;
  const s = sessionsOf(d).slice();
  const last = s[s.length - 1];
  s[s.length - 1] = { ...last, out: Math.max(ms, last.in), ...(by === 'auto' ? { outBy: 'auto' } : {}) };
  return { ...d, sessions: s };
}
// for automatic recording: a quick exit and re-entry is the same visit, so reopen instead of splitting
export function resumeDay(d, ms, gapMs) {
  const s = sessionsOf(d);
  const last = s[s.length - 1];
  if (last && last.out != null && ms - last.out < gapMs) {
    const copy = s.slice();
    const { outBy, ...rest } = last;
    copy[copy.length - 1] = { ...rest, out: null, ro: { at: ms, out: last.out, outBy: outBy ?? null } }; // ro lets Undo put the old check out back
    return { ...d, done: false, sessions: copy };
  }
  return checkInDay(d, ms, 'auto');
}

// reverses an automatic check in ("in") or check out ("out") that happened at "at".
// it only touches the session if it really is that automatic record, so tapping Undo twice, or late, does nothing.
// it also pauses the automatic mode for the rest of that day, otherwise the next check would just redo it
export function undoAuto(d, kind, at) {
  const s = sessionsOf(d);
  const last = s[s.length - 1];
  if (!last) return d;
  if (kind === 'in') {
    if (last.out != null) return d;
    if (last.ro && last.ro.at === at) {
      const copy = s.slice();
      const { ro, inBy, ...rest } = last;
      copy[copy.length - 1] = { ...rest, ...(inBy ? { inBy } : {}), out: last.ro.out, ...(last.ro.outBy ? { outBy: last.ro.outBy } : {}) };
      return { ...d, noAuto: true, sessions: copy };
    }
    if (last.inBy === 'auto' && last.in === at) return { ...d, noAuto: true, sessions: s.slice(0, -1) };
    return d;
  }
  if (kind === 'out' && last.outBy === 'auto' && last.out === at) {
    const copy = s.slice();
    const { outBy, ...rest } = last;
    copy[copy.length - 1] = { ...rest, out: null };
    return { ...d, noAuto: true, done: false, sessions: copy };
  }
  return d;
}

// hours between check in and check out. an open session only counts live if it is today
export function workedMs(d, isToday, nowMs) {
  let t = 0;
  for (const s of sessionsOf(d)) {
    if (s.out != null) t += Math.max(0, s.out - s.in);
    else if (isToday) t += Math.max(0, nowMs - s.in);
  }
  return t;
}

// old saves had {in, out, off}. this turns them into the sessions and type format
export function migrateDay(d) {
  if (!d || typeof d !== 'object') return null;
  const o = { ...d };
  if ('in' in o || 'out' in o) {
    if (o.in) o.sessions = [{ in: o.in, out: o.out ?? null }];
    delete o.in;
    delete o.out;
  }
  if ('off' in o) {
    if (o.off) o.type = 'leave';
    delete o.off;
  }
  if (Array.isArray(o.sessions)) {
    o.sessions = o.sessions
      .filter((x) => x && Number.isFinite(x.in) && (x.out == null || Number.isFinite(x.out)))
      .map((x) => ({ in: x.in, out: x.out ?? null, ...(x.inBy ? { inBy: x.inBy } : {}), ...(x.outBy ? { outBy: x.outBy } : {}), ...(x.ro ? { ro: x.ro } : {}) }));
  }
  return o;
}

// anything older than 3 months gets dropped
export function purgeOld(days, now) {
  const cutoff = dateKey(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()));
  const kept = {};
  for (const k of Object.keys(days)) if (k >= cutoff) kept[k] = days[k];
  return kept;
}

// ---------- today's hours ----------

// how far today's hours are allowed to move.
// R = hours still owed, wT = weight of today, sumW = weight of today plus the free days after it
export function todayRange(R, wT = 1, sumW = 1) {
  if (R <= 0 || wT <= 0) return { lo: 0, hi: 0, equal: 0 };
  if (sumW <= wT + 1e-9) return { lo: R, hi: R, equal: R };
  const equal = (R * wT) / sumW;
  // below lo0 the later days get too long. if even that is impossible I cap at the longest day I allow
  const lo0 = Math.min(MAX_H * wT, Math.max(MIN_H * wT, R - (sumW - wT) * MAX_H));
  const hi = Math.max(lo0, Math.min(MAX_H * wT, equal + 2 * wT));
  const lo = Math.min(Math.max(lo0, equal - 2 * wT), hi);
  return { lo, hi, equal };
}

export function clampToday(t, R, wT = 1, sumW = 1) {
  if (R <= 0 || wT <= 0) return 0;
  const { lo, hi } = todayRange(R, wT, sumW);
  const v = Math.min(hi, Math.max(lo, Number.isFinite(t) ? t : lo));
  return Math.min(R, quarter(v));
}

// when to check in and out for a day of "hours" length.
// I keep my usual arrival unless that makes me miss the office end time, then I come earlier
export function suggestTimes(hours, typicalArrival, endMin) {
  const len = Math.round(hours * 60);
  let inMin = Math.min(typicalArrival, endMin - len);
  inMin = Math.max(EARLIEST_IN, inMin);
  inMin = Math.floor(inMin / 5) * 5;
  return { inMin, outMin: inMin + len };
}

// ---------- office detection ----------

// metres between two coordinates
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// what the automatic mode should do right now. dist and radius are in metres.
// leaving needs a margin (25 percent past the radius) so GPS wobble on the edge cannot flip it back and forth.
// arriving only auto-records when I have no visit yet, or my last visit was closed by the auto mode,
// so a manual check out is never undone behind my back
export function autoAction({ dist, radius, day, weight, hour }) {
  if (!(weight > 0) || day?.done || day?.noAuto || hour < 5) return null;
  if (isLive(day)) return dist > radius * 1.25 ? 'out' : null;
  const s = sessionsOf(day);
  const last = s[s.length - 1];
  if (dist <= radius && (!last || last.outBy === 'auto')) return 'in';
  return null;
}

// ---------- the month ----------

// everything the screens need for the current month.
// opts.pins fixes the hours of chosen days, which is how the what-if simulator works
export function monthStats(days, s, now, opts = {}) {
  const pins = opts.pins ?? {};
  const y = now.getFullYear();
  const m = now.getMonth();
  const todayK = dateKey(now);
  const nowMs = now.getTime();
  const keys = keysOfMonth(y, m);
  const w = (k) => weightOf(k, days[k]);

  let beforeMs = 0;
  let todayMs = 0;
  for (const k of keys) {
    const d = days[k];
    if (!d || k > todayK) continue;
    const ms = workedMs(d, k === todayK, nowMs);
    if (k === todayK) todayMs = ms;
    else beforeMs += ms;
  }
  const beforeH = beforeMs / HOUR;
  const todayH = todayMs / HOUR;
  const worked = beforeH + todayH;

  const target = s.target;
  const floor = s.target - s.margin;
  const R = Math.max(0, target - beforeH); // what I owed when today started

  const futureKeys = keys.filter((k) => k > todayK && w(k) > 0);
  const pinnedKeys = futureKeys.filter((k) => pins[k] != null);
  const pinnedH = pinnedKeys.reduce((a, k) => a + pins[k], 0);
  const freeW = futureKeys.filter((k) => pins[k] == null).reduce((a, k) => a + w(k), 0);

  // today, assuming it is still a working day
  const wToday = w(todayK);
  const todayD = days[todayK];
  const Rp = Math.max(0, R - pinnedH);
  const sumWp = wToday + freeW;
  let todayPlan = 0;
  let finished = false;
  if (wToday > 0) {
    // a what-if pin is taken as is, a stored or default plan is kept inside the safe range
    const stored = todayD?.plan?.hours ?? (sumWp ? (Rp * wToday) / sumWp : 0);
    todayPlan = pins[todayK] != null ? pins[todayK] : clampToday(stored, Rp, wToday, sumWp);
    const sess = sessionsOf(todayD);
    finished = !!todayD?.done || (sess.length > 0 && !isLive(todayD) && todayH >= todayPlan - 0.084);
  }
  const todayOpen = wToday > 0 && !finished;

  // hours left for the days after today, shared by weight
  const base = todayOpen ? Math.max(0, R - todayPlan) : Math.max(0, target - worked);
  const perUnit = freeW ? Math.max(0, base - pinnedH) / freeW : 0;

  const weightsLeft = freeW + pinnedKeys.reduce((a, k) => a + w(k), 0) + (todayOpen ? wToday : 0);
  const daysLeft = futureKeys.length + (todayOpen ? 1 : 0);

  // what my own history says about me
  const recs = Object.entries(days).filter(([k, d]) => sessionsOf(d).length && weightOf(k, d) > 0);
  const arrivals = recs.map(([, d]) => minOfDay(new Date(d.sessions[0].in)));
  const lens = recs
    .filter(([k, d]) => k !== todayK && !isLive(d))
    .map(([k, d]) => workedMs(d, false, 0) / HOUR / weightOf(k, d));
  const endMin = parseHM(s.officialEnd) ?? 18 * 60;
  const typicalArrival = Math.round(median(arrivals) ?? parseHM(s.officialStart) ?? 9 * 60);
  const typicalH = median(lens);
  // where I land if I keep my usual pace
  const projected = typicalH == null ? null : beforeH + (todayOpen ? 0 : todayH) + typicalH * weightsLeft;

  const rows = [];
  for (const k of keys) {
    const d = days[k];
    const sess = sessionsOf(d);
    if (!isWeekday(k) && !sess.length) continue;
    const type = typeOf(d);
    let state;
    if (TYPES[type].w === 0 && isWeekday(k)) state = 'off';
    else if (k < todayK) state = sess.length ? (isLive(d) ? 'noout' : 'done') : 'missed';
    else if (k === todayK) state = finished ? 'done' : !sess.length ? 'today' : isLive(d) ? 'live' : 'break';
    else state = 'future';

    const row = {
      key: k,
      state,
      type,
      sessions: sess,
      worked: workedMs(d, k === todayK, nowMs) / HOUR,
      inMs: sess[0]?.in ?? null,
      outMs: sess.length && !isLive(d) ? sess[sess.length - 1].out : null,
      hours: 0,
      planInMs: null,
      planOutMs: null,
    };
    if (state === 'today' || state === 'live' || state === 'break' || state === 'future') {
      row.hours = k === todayK ? todayPlan : (pins[k] ?? perUnit * w(k));
      if (row.hours > 0) {
        if (state === 'live') {
          const open = sess[sess.length - 1];
          const closedMs = workedMs({ sessions: sess.slice(0, -1) }, false, 0);
          row.planInMs = sess[0].in;
          row.planOutMs = open.in + Math.max(0, Math.round(row.hours * HOUR) - closedMs);
        } else if (state !== 'break') {
          const t = suggestTimes(row.hours, typicalArrival, endMin);
          row.planInMs = at(k, t.inMin).getTime();
          row.planOutMs = at(k, t.outMin).getTime();
        }
      }
    }
    rows.push(row);
  }
  const next = rows.find((r) => r.key > todayK && r.state === 'future' && r.hours > 0) ?? null;
  const needPerDay = weightsLeft ? (todayOpen ? Rp : Math.max(0, target - worked)) / weightsLeft : 0;

  return {
    todayKey: todayK,
    target,
    floor,
    worked,
    todayH,
    remaining: Math.max(0, target - worked),
    toFloor: Math.max(0, floor - worked),
    dayStartNeed: R,
    daysLeft,
    weightsLeft,
    todayOpen,
    finished,
    todayWeight: wToday,
    todayPlan,
    planCtx: { R: Rp, wT: wToday, sumW: sumWp },
    futurePerDay: perUnit,
    typicalArrival,
    typicalH,
    projected,
    endMin,
    needPerDay,
    tooHeavy: weightsLeft > 0 && needPerDay > MAX_H + 1e-9,
    rows,
    next,
  };
}

// ---------- what-if ----------

// scenario: { key, kind: 'leave' | 'hours' | 'off' | 'half', value }
// 'leave' value is minutes after midnight, 'hours' value is hours
export function simulate(days, s, now, scenario) {
  const base = monthStats(days, s, now);
  const k = scenario.key;
  const d2 = { ...days };
  const pins = {};
  if (scenario.kind === 'off') d2[k] = { ...(days[k] ?? {}), type: 'leave' };
  else if (scenario.kind === 'half') d2[k] = { ...(days[k] ?? {}), type: 'half' };
  else if (scenario.kind === 'hours') pins[k] = Math.max(0, scenario.value);
  else if (scenario.kind === 'leave') {
    const row = base.rows.find((r) => r.key === k);
    if (row?.state === 'live') {
      const open = row.sessions[row.sessions.length - 1];
      const closedMs = workedMs({ sessions: row.sessions.slice(0, -1) }, false, 0);
      pins[k] = Math.max(0, (closedMs + at(k, scenario.value).getTime() - open.in) / HOUR);
    } else {
      pins[k] = Math.max(0, (scenario.value - base.typicalArrival) / 60);
    }
  }
  return { base, next: monthStats(d2, s, now, { pins }) };
}

// ---------- charts and coach ----------

// last n working days up to today for the bar chart
export function dailySeries(days, now, n) {
  const todayK = dateKey(now);
  const out = [];
  for (let i = 0; out.length < n && i < 120; i++) {
    const k = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    const d = days[k];
    if (!isWeekday(k) && !sessionsOf(d).length) continue;
    if (TYPES[typeOf(d)].w === 0 && isWeekday(k)) continue;
    out.push({
      key: k,
      hours: workedMs(d, k === todayK, now.getTime()) / HOUR,
      firstIn: sessionsOf(d).length ? minOfDay(new Date(d.sessions[0].in)) : null,
    });
  }
  return out.reverse();
}

// hours per week, weeks start on Monday
export function weeklyTotals(days, now, weeks = 8) {
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - i * 7);
    let ms = 0;
    for (let j = 0; j < 7; j++) {
      const k = dateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + j));
      ms += workedMs(days[k], k === dateKey(now), now.getTime());
    }
    out.push({ key: dateKey(start), hours: ms / HOUR });
  }
  return out;
}

// compact facts for the chat. every number is already worked out here so the model only has to talk
export function coachContext(days, s, now, st) {
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const recent = dailySeries(days, now, 10).map((x) => ({
    date: x.key,
    day: DOW[parseKey(x.key).getDay()],
    firstCheckIn: x.firstIn == null ? null : fmtMin(x.firstIn),
    hours: r2(x.hours),
    sessions: sessionsOf(days[x.key]).length,
  }));
  return {
    today: `${DOW[now.getDay()]} ${dateKey(now)}`,
    month: {
      workedHours: r2(st.worked),
      targetHours: st.target,
      safeMinimumHours: st.floor,
      hoursLeftToTarget: r2(st.remaining),
      workingDaysLeft: st.daysLeft,
      averageNeededPerDay: r2(st.needPerDay),
      projectedAtUsualPace: st.projected == null ? null : r2(st.projected),
      usualCheckIn: fmtMin(st.typicalArrival),
      usualDayHours: st.typicalH == null ? null : r2(st.typicalH),
      officeEnds: fmtMin(st.endMin),
    },
    recentDays: recent,
    plannedNextDays: st.rows
      .filter((r) => (r.state === 'today' || r.state === 'future') && r.planInMs)
      .slice(0, 5)
      .map((r) => ({ date: r.key, checkIn: fmtTime(r.planInMs), leave: fmtTime(r.planOutMs), hours: r2(r.hours) })),
  };
}

// ---------- cloud sync ----------

// the settings that follow me to another phone. the name travels with the profile instead, and device specific ones (office spot, lock, geo mode, calendar) stay put
export const SYNC_KEYS = ['target', 'margin', 'officialStart', 'officialEnd', 'plannerAt', 'alarms', 'theme', 'model', 'sounds', 'radius'];

export function pickSync(settings) {
  const o = {};
  for (const k of SYNC_KEYS) if (settings?.[k] !== undefined) o[k] = settings[k];
  o.su = settings?.su ?? 0; // when these settings last changed
  return o;
}

// a short fingerprint of everything that syncs, used to know when something really changed
export const syncSig = (days, settings) => JSON.stringify([days, SYNC_KEYS.map((k) => settings?.[k])]);

// two copies of my data become one. each day keeps whichever copy was changed last (u is the time of its last change),
// the settings follow whichever side changed them last. nothing is ever deleted by a merge
export function mergeStates(local, remote) {
  const days = {};
  const keys = new Set([...Object.keys(local.days ?? {}), ...Object.keys(remote.days ?? {})]);
  for (const k of keys) {
    const a = local.days?.[k];
    const b = remote.days?.[k];
    days[k] = !b ? a : !a ? b : (b.u ?? 0) > (a.u ?? 0) ? b : a;
  }
  const ls = local.settings ?? {};
  const rs = remote.settings ?? {};
  const settings = (rs.su ?? 0) > (ls.su ?? 0) ? { ...ls, ...rs } : { ...rs, ...ls };
  settings.su = Math.max(ls.su ?? 0, rs.su ?? 0);
  return { days, settings };
}

// ---------- import, export, restore ----------

// what Groq returns from a pasted HRM table gets checked here, the model never writes straight into my data
export function validateImport(parsed, now) {
  const cutoff = dateKey(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()));
  const today = dateKey(now);
  const ok = [];
  const rejected = [];
  const list = Array.isArray(parsed?.days) ? parsed.days : [];
  const seen = new Set();
  for (const r of list) {
    const key = String(r?.date ?? '');
    const a = parseHM(r?.in ?? '');
    const b = parseHM(r?.out ?? '');
    let why = null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || dateKey(parseKey(key)) !== key) why = 'bad date';
    else if (key < cutoff) why = 'older than 3 months';
    else if (key > today) why = 'in the future';
    else if (a == null || b == null) why = 'missing time';
    else if (b <= a) why = 'out is not after in';
    else if (seen.has(key)) why = 'duplicate date';
    if (why) rejected.push({ date: key || '?', why });
    else {
      seen.add(key);
      ok.push({ key, in: at(key, a).getTime(), out: at(key, b).getTime() });
    }
  }
  return { ok: ok.sort((x, y) => (x.key < y.key ? -1 : 1)), rejected };
}

export function toCsv(days) {
  const rows = ['date,type,first_in,last_out,sessions,hours'];
  for (const k of Object.keys(days).sort()) {
    const d = days[k];
    const sess = sessionsOf(d);
    const first = sess[0] ? fmtTime(sess[0].in) : '';
    const last = sess.length && sess[sess.length - 1].out != null ? fmtTime(sess[sess.length - 1].out) : '';
    rows.push([k, typeOf(d), first, last, sess.length, r2(workedMs(d, false, 0) / HOUR)].join(','));
  }
  return rows.join('\n');
}

// restore from the JSON text I exported earlier
export function parseBackup(text) {
  let o;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error('That is not valid backup text.');
  }
  if (!o || typeof o !== 'object' || typeof o.days !== 'object' || o.days === null) {
    throw new Error('No days found in that backup.');
  }
  const days = {};
  for (const [k, v] of Object.entries(o.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    const d = migrateDay(v);
    if (d) days[k] = d;
  }
  return { days, settings: o.settings && typeof o.settings === 'object' ? o.settings : null };
}
