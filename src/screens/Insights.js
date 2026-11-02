import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Line as SvgLine, Path, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { MAX_H, dailySeries, fmtH, fmtMin, parseHM, parseKey, simulate, weeklyTotals } from '../logic';
import { Card, Chip, FadeIn, Field, Icon, Notice, Screen, ScreenHeader, Stat, Txt, tint, useTheme } from '../ui';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// bars with a gradient, the dashed line is the goal. labels are plain text under the bars
function BarChart({ data, goal, height = 130 }) {
  const { c } = useTheme();
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1) * 1.12;
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end' }}>
        {goal ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: (goal / max) * height, borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.warn }} /> : null}
        {data.map((d) => {
          const hit = d.value >= (goal ?? Infinity) * 0.95;
          return (
            <View key={d.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
              {d.value > 0 ? (
                <LinearGradient colors={hit ? [c.good, c.brand2] : c.grad} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={{ width: '64%', height: Math.max(4, (d.value / max) * height), borderRadius: 6 }} />
              ) : (
                <View style={{ width: '64%', height: 3, borderRadius: 2, backgroundColor: c.border }} />
              )}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {data.map((d) => (
          <Txt key={d.key} v="small" color="faint" align="center" style={{ flex: 1, fontSize: 9, lineHeight: 12 }}>{d.label}</Txt>
        ))}
      </View>
    </View>
  );
}

// check in time per day as a smooth line over a soft area. the dashed line is the office start
function ArrivalChart({ points, ref0, height = 130 }) {
  const { c } = useTheme();
  const [w, setW] = useState(300);
  const id = useRef(`arr${Math.random().toString(36).slice(2, 7)}`).current;
  const pts = points.map((p, i) => ({ ...p, i })).filter((p) => p.v != null);
  if (pts.length < 2) return <Txt v="small" color="dim">Needs a few more days of check ins.</Txt>;
  const vals = pts.map((p) => p.v);
  const lo = Math.min(...vals, ref0) - 12;
  const hi = Math.max(...vals, ref0) + 12;
  const x = (i) => 8 + (i * (w - 16)) / Math.max(1, points.length - 1);
  const y = (v) => 8 + ((v - lo) / (hi - lo)) * (height - 16);
  // a smooth path through the points
  let d = `M ${x(pts[0].i)} ${y(pts[0].v)}`;
  for (let n = 1; n < pts.length; n++) {
    const a = pts[n - 1];
    const b = pts[n];
    const mx = (x(a.i) + x(b.i)) / 2;
    d += ` C ${mx} ${y(a.v)}, ${mx} ${y(b.v)}, ${x(b.i)} ${y(b.v)}`;
  }
  const area = `${d} L ${x(pts[pts.length - 1].i)} ${height} L ${x(pts[0].i)} ${height} Z`;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={height}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.brand} stopOpacity="0.35" />
            <Stop offset="1" stopColor={c.brand} stopOpacity="0" />
          </SvgGradient>
        </Defs>
        <SvgLine x1={0} x2={w} y1={y(ref0)} y2={y(ref0)} stroke={c.warn} strokeWidth={1} strokeDasharray="4 5" />
        <Path d={area} fill={`url(#${id})`} />
        <Path d={d} stroke={c.brand} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {pts.map((p) => (
          <Circle key={p.key} cx={x(p.i)} cy={y(p.v)} r={3.5} fill={c.surface} stroke={c.brand} strokeWidth={2} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Txt v="small" color="faint" style={{ fontSize: 11 }}>higher is earlier</Txt>
        <Txt v="small" color="warn" style={{ fontSize: 11 }}>dashed: office start {fmtMin(ref0)}</Txt>
      </View>
    </View>
  );
}

const KINDS = [
  ['leave', 'Leave at', 'logout'],
  ['hours', 'Work for', 'hourglass'],
  ['half', 'Half day', 'sunMedium'],
  ['off', 'Day off', 'palm'],
];

function Delta({ label, from, to, tone }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Txt v="small" color="dim">{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Txt v="small" color="faint">{from}</Txt>
        <Icon name="arrowR" size={14} color="faint" style={{ marginHorizontal: 6 }} />
        <Txt v="title" color={tone}>{to}</Txt>
      </View>
    </View>
  );
}

function WhatIf({ days, settings, stats, now }) {
  const { c } = useTheme();
  const options = stats.rows.filter((r) => ['today', 'live', 'break', 'future'].includes(r.state)).slice(0, 10);
  const [key, setKey] = useState(options[0]?.key ?? null);
  const [kind, setKind] = useState('leave');
  const [val, setVal] = useState('16:00');

  const result = useMemo(() => {
    if (!key) return null;
    let value = 0;
    if (kind === 'leave') {
      value = parseHM(val);
      if (value == null) return { error: 'Type the leave time like 16:00' };
    } else if (kind === 'hours') {
      value = Number(val);
      if (!(value >= 0)) return { error: 'Type the hours, like 6.5' };
    }
    return simulate(days, settings, now, { key, kind, value });
  }, [days, settings, stats, key, kind, val]);

  if (!options.length) return <Txt v="small" color="dim">No working days left this month.</Txt>;

  const diff = result && !result.error ? result.next.futurePerDay - result.base.futurePerDay : 0;
  const bad = result && !result.error && result.next.futurePerDay > MAX_H + 1e-9;
  const tone = bad ? 'bad' : diff > 0.01 ? 'warn' : 'good';

  return (
    <View>
      <Txt v="caption" color="faint" style={{ marginBottom: 8 }}>Pick a day</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map((r) => {
          const d = parseKey(r.key);
          return <Chip key={r.key} label={`${DOW[d.getDay()]} ${d.getDate()}`} on={key === r.key} onPress={() => setKey(r.key)} />;
        })}
      </ScrollView>
      <Txt v="caption" color="faint" style={{ marginTop: 6, marginBottom: 8 }}>What happens</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {KINDS.map(([id, label, icon]) => (
          <Chip key={id} label={label} icon={icon} on={kind === id} onPress={() => { setKind(id); setVal(id === 'leave' ? '16:00' : id === 'hours' ? '6' : ''); }} />
        ))}
      </View>
      {kind === 'leave' || kind === 'hours' ? (
        <Field icon={kind === 'leave' ? 'clock' : 'hourglass'} value={val} onChangeText={setVal} placeholder={kind === 'leave' ? 'HH:MM' : 'hours'} keyboardType="numbers-and-punctuation" style={{ marginTop: 6, marginBottom: 4 }} />
      ) : null}

      {result?.error ? <Notice tone="warn" text={result.error} /> : null}
      {result && !result.error ? (
        <View style={{ backgroundColor: tint(c[tone], 0.1), borderRadius: 18, padding: 14, marginTop: 10, borderWidth: 1, borderColor: tint(c[tone], 0.3) }}>
          {kind === 'leave' ? <Txt v="small" color="dim" style={{ marginBottom: 4 }}>That day counts from your usual check in, {fmtMin(result.base.typicalArrival)}.</Txt> : null}
          {result.base.todayOpen && key !== result.base.todayKey ? <Delta label="Today" from={fmtH(result.base.todayPlan)} to={fmtH(result.next.todayPlan)} tone="text" /> : null}
          <Delta label="Each other day" from={fmtH(result.base.futurePerDay)} to={fmtH(result.next.futurePerDay)} tone={tone} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Icon name={bad ? 'info' : 'checkCircle'} size={18} color={tone} style={{ marginRight: 8 }} />
            <Txt v="small" w={600} color={tone} style={{ flex: 1 }}>
              {bad ? `Not realistic, the other days would need more than ${MAX_H}h.` : diff > 0.01 ? `You still reach the target, each other day grows by ${fmtH(diff)}.` : 'You still reach the target with no extra effort.'}
            </Txt>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function Insights({ days, settings, stats, now }) {
  const daily = useMemo(() => dailySeries(days, now, 20), [days, now]);
  const weekly = useMemo(() => weeklyTotals(days, now, 8), [days, now]);
  const full = (parseHM(settings.officialEnd) - parseHM(settings.officialStart)) / 60;
  const arrivals = daily.filter((d) => d.firstIn != null).map((d) => d.firstIn);
  const hrs = daily.filter((d) => d.hours > 0).map((d) => d.hours);
  const best = Math.max(0, ...weekly.map((w) => w.hours));

  return (
    <Screen>
      <ScreenHeader title="Insights" sub="Your last weeks at a glance" />

      <FadeIn>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Stat icon="login" label="Usual in" value={fmtMin(stats.typicalArrival)} tone="brand" />
          <View style={{ width: 10 }} />
          <Stat icon="clock" label="Average day" value={hrs.length ? fmtH(hrs.reduce((a, b) => a + b, 0) / hrs.length) : '-'} tone="good" />
          <View style={{ width: 10 }} />
          <Stat icon="flame" label="Best week" value={best ? `${Math.round(best * 10) / 10}h` : '-'} tone="warn" />
        </View>
      </FadeIn>

      <FadeIn delay={70}>
        <Card>
          <Txt v="title">Hours per day</Txt>
          <Txt v="small" color="dim" style={{ marginTop: 2, marginBottom: 14 }}>Last 20 working days. Green bars reached {fmtH(full)}.</Txt>
          <BarChart data={daily.map((d) => ({ key: d.key, label: String(parseKey(d.key).getDate()), value: d.hours }))} goal={full} />
        </Card>
      </FadeIn>

      <FadeIn delay={120}>
        <Card>
          <Txt v="title">Hours per week</Txt>
          <Txt v="small" color="dim" style={{ marginTop: 2, marginBottom: 14 }}>Each bar starts on the Monday shown.</Txt>
          <BarChart data={weekly.map((w) => ({ key: w.key, label: String(parseKey(w.key).getDate()), value: w.hours }))} goal={full * 5} height={110} />
        </Card>
      </FadeIn>

      <FadeIn delay={170}>
        <Card>
          <Txt v="title">When you check in</Txt>
          <Txt v="small" color="dim" style={{ marginTop: 2, marginBottom: 14 }}>
            {arrivals.length ? `Earliest ${fmtMin(Math.min(...arrivals))}, latest ${fmtMin(Math.max(...arrivals))}` : 'Your arrival times will show up here.'}
          </Txt>
          <ArrivalChart points={daily.map((d) => ({ key: d.key, v: d.firstIn }))} ref0={parseHM(settings.officialStart)} />
        </Card>
      </FadeIn>

      <FadeIn delay={220}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Icon name="zap" size={20} color="warn" style={{ marginRight: 10 }} />
            <View>
              <Txt v="title">What if</Txt>
              <Txt v="small" color="dim">Exact numbers, no guessing</Txt>
            </View>
          </View>
          <WhatIf days={days} settings={settings} stats={stats} now={now} />
        </Card>
      </FadeIn>
    </Screen>
  );
}
