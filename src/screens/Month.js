import React from 'react';
import { Pressable, View } from 'react-native';
import { TYPES, fmtH, fmtMin, fmtTime, parseHM, parseKey } from '../logic';
import { Card, FadeIn, Icon, Pill, Screen, Section, Stat, TYPE_ICON, Txt, tint, useTheme } from '../ui';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// text, colour and pill tone for one day in the list
function describe(r) {
  const visits = r.sessions.length > 1 ? ` · ${r.sessions.length} visits` : '';
  switch (r.state) {
    case 'done':
      return { text: `${fmtTime(r.inMs)} to ${fmtTime(r.sessions[r.sessions.length - 1].out)}${visits}`, right: fmtH(r.worked), tone: 'good' };
    case 'live':
      return { text: `In at ${fmtTime(r.inMs)}, leave ${fmtTime(r.planOutMs)}${visits}`, right: fmtH(r.worked), tone: 'brand' };
    case 'break':
      return { text: `Out of office, ${fmtH(r.hours - r.worked)} to go`, right: fmtH(r.worked), tone: 'warn' };
    case 'today':
    case 'future':
      return r.planInMs ? { text: `Plan ${fmtTime(r.planInMs)} to ${fmtTime(r.planOutMs)}`, right: fmtH(r.hours), tone: 'faint' } : { text: 'Target reached', right: '0h', tone: 'good' };
    case 'noout':
      return { text: `In at ${fmtTime(r.inMs)}, no check out saved`, right: '0h', tone: 'warn' };
    case 'off':
      return { text: TYPES[r.type].label, right: '-', tone: 'faint' };
    default:
      return { text: 'No record', right: '0h', tone: 'bad' };
  }
}

// colour of one cell in the month heat map
function cellStyle(r, full, c) {
  if (!r) return { fill: 'transparent', text: c.faint, border: 'transparent' };
  switch (r.state) {
    case 'done': {
      const k = r.worked / full;
      const col = k >= 0.95 ? c.good : k >= 0.75 ? c.warn : c.bad;
      return { fill: tint(col, 0.24), text: col, border: 'transparent' };
    }
    case 'live':
    case 'break':
    case 'today':
      return { fill: tint(c.brand, 0.2), text: c.brand, border: c.brand };
    case 'missed':
      return { fill: tint(c.bad, 0.1), text: c.bad, border: tint(c.bad, 0.4) };
    case 'noout':
      return { fill: tint(c.warn, 0.14), text: c.warn, border: tint(c.warn, 0.5) };
    case 'off':
      return { fill: tint(c.faint, 0.16), text: c.faint, border: 'transparent' };
    default:
      return { fill: 'transparent', text: c.dim, border: c.border };
  }
}

function Legend({ color, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, marginTop: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, marginRight: 6 }} />
      <Txt v="small" color="dim" style={{ fontSize: 12 }}>{label}</Txt>
    </View>
  );
}

export default function Month({ now, stats, settings, onEdit }) {
  const { c } = useTheme();
  const full = Math.max(1, (parseHM(settings.officialEnd) - parseHM(settings.officialStart)) / 60);
  const byKey = Object.fromEntries(stats.rows.map((r) => [r.key, r]));
  const y = now.getFullYear();
  const m = now.getMonth();
  const count = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${y}-${pad(m + 1)}-${pad(d)}`;

  return (
    <Screen title={MONTHS[m]} sub={`${y} · ${fmtH(stats.worked)} of ${stats.target}h`} right={<Pill label={`${stats.daysLeft} days left`} icon="calendarDays" />}>

      <FadeIn>
        <Card>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center' }}>
                <Txt v="small" color="faint" w={700}>{d}</Txt>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) => {
              if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 46 }} />;
              const k = keyOf(d);
              const r = byKey[k];
              const s = cellStyle(r, full, c);
              const today = k === stats.todayKey;
              return (
                <View key={i} style={{ width: `${100 / 7}%`, height: 46, padding: 2 }}>
                  <Pressable onPress={() => onEdit(k)} style={{ flex: 1, borderRadius: 12, backgroundColor: s.fill, borderWidth: today ? 2 : 1, borderColor: today ? c.brand : s.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt v="small" w={700} color={s.text}>{d}</Txt>
                    {r && (r.state === 'done' || r.state === 'live') ? <Txt v="small" color={s.text} style={{ fontSize: 9, lineHeight: 11 }}>{fmtH(r.worked).replace(' ', '').replace('m', '')}</Txt> : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            <Legend color={c.good} label="Full day" />
            <Legend color={c.warn} label="Short" />
            <Legend color={c.bad} label="Missed" />
            <Legend color={c.brand} label="Today" />
            <Legend color={c.faint} label="Off" />
          </View>
        </Card>
      </FadeIn>

      <FadeIn delay={80}>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Stat icon="hourglass" label="Left" value={`${Math.round(stats.remaining)}h`} tone="warn" />
          <View style={{ width: 10 }} />
          <Stat icon="login" label="Usual in" value={fmtMin(stats.typicalArrival)} tone="brand" />
          <View style={{ width: 10 }} />
          <Stat icon="clock" label="Usual day" value={stats.typicalH == null ? '-' : fmtH(stats.typicalH)} tone="good" />
        </View>
      </FadeIn>

      <Section title="Every day" right={<Txt v="small" color="faint">tap to edit</Txt>} />
      {stats.rows.map((r) => {
        const d = parseKey(r.key);
        const info = describe(r);
        const today = r.key === stats.todayKey;
        const col = c[info.tone] ?? c.faint;
        return (
          <Pressable
            key={r.key}
            onPress={() => onEdit(r.key)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 18, padding: 12, marginBottom: 8, borderWidth: today ? 1.5 : 1, borderColor: today ? c.brand : c.border }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: tint(col, 0.14), alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Txt v="small" w={700} color={col} style={{ fontSize: 11, lineHeight: 13 }}>{DOW[d.getDay()]}</Txt>
              <Txt v="title" color={col} style={{ lineHeight: 20 }}>{d.getDate()}</Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="small" w={600}>{info.text}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                <Icon name={TYPE_ICON[r.type]} size={13} color="faint" style={{ marginRight: 5 }} />
                <Txt v="small" color="faint" style={{ fontSize: 12 }}>{TYPES[r.type].label}</Txt>
              </View>
            </View>
            <Txt v="title" color={col}>{info.right}</Txt>
          </Pressable>
        );
      })}
    </Screen>
  );
}
