// the artwork on the landing screens: the brand mark and one little live scene per intro slide. all drawn in code, nothing to download
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { Icon } from './icons';
import { Txt, tint, useTheme } from './theme';

// 0 to 1 and back, forever
function useLoop(dur = 1900, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: dur, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return v;
}

// 0 to 1 once, after a delay
function useIn(delay = 0, dur = 700) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: dur, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return v;
}

function Float({ delay, children, style }) {
  const v = useLoop(1900, delay);
  return <Animated.View style={[style, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }] }]}>{children}</Animated.View>;
}

// the small floating label used around the scenes
function Tag({ icon, text, tone = 'brand', delay = 0, style }) {
  const { c, shadow } = useTheme();
  const col = c[tone];
  return (
    <Float delay={delay} style={[{ position: 'absolute' }, style]}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 11, borderWidth: 1, borderColor: c.border }, shadow, { shadowOpacity: 0.22, elevation: 6 }]}>
        <View style={{ width: 22, height: 22, borderRadius: 8, backgroundColor: tint(col, 0.16), alignItems: 'center', justifyContent: 'center', marginRight: 7 }}>
          <Icon name={icon} size={13} color={col} />
        </View>
        <Txt v="small" w={700} style={{ fontSize: 12, lineHeight: 16 }}>{text}</Txt>
      </View>
    </Float>
  );
}

function Mock({ children, style }) {
  const { c, shadow } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 14 }, shadow, { shadowOpacity: 0.25, shadowRadius: 22, elevation: 8 }, style]}>{children}</View>;
}

function Tile({ icon, size = 36, colors }) {
  const { c } = useTheme();
  return (
    <LinearGradient colors={colors ?? c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.32, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.5} color="#FFFFFF" stroke={1.9} />
    </LinearGradient>
  );
}

// ---------- the brand mark: a glowing tile, pulse rings and a dot in orbit ----------

function PulseRing({ size, delay }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: 2800, easing: Easing.out(Easing.quad), useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', width: size, height: size, borderRadius: size * 0.32, borderWidth: 2, borderColor: c.brand2, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }] }}
    />
  );
}

export function Brand({ size = 96, icon = 'timer', rings = true }) {
  const { c } = useTheme();
  const box = size * 2.1;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
      {rings ? (
        <>
          <PulseRing size={size} delay={0} />
          <PulseRing size={size} delay={930} />
          <PulseRing size={size} delay={1860} />
          <Animated.View pointerEvents="none" style={{ position: 'absolute', width: box * 0.86, height: box * 0.86, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <Svg width={box * 0.86} height={box * 0.86}>
              <Circle cx={box * 0.43} cy={box * 0.43} r={box * 0.42} stroke={tint(c.brand, 0.22)} strokeWidth={1.2} strokeDasharray="2 8" fill="none" />
              <Circle cx={box * 0.43} cy={box * 0.01} r={4.5} fill={c.brand2} />
              <Circle cx={box * 0.01} cy={box * 0.43} r={3} fill={c.brand} />
            </Svg>
          </Animated.View>
        </>
      ) : null}
      <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center', shadowColor: c.brand, shadowOpacity: 0.6, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 16 }}>
        <Icon name={icon} size={size * 0.5} color="#FFFFFF" stroke={1.8} />
      </LinearGradient>
    </View>
  );
}

// ---------- scenes ----------

function Welcome({ w, h }) {
  return (
    <View style={{ width: w, height: h }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: h / 2 - w * 0.5 }}>
        <Brand size={Math.min(w, h) * 0.32} />
      </View>
      <Tag icon="target" text="198h goal" tone="good" style={{ left: 0, top: h * 0.1 }} />
      <Tag icon="radar" text="Auto check in" tone="brand2" delay={400} style={{ right: 0, top: h * 0.04 }} />
      <Tag icon="sparkles" text="AI day plan" tone="brand" delay={800} style={{ left: w * 0.02, bottom: h * 0.08 }} />
      <Tag icon="cloud" text="Cloud sync" tone="info" delay={1200} style={{ right: w * 0.02, bottom: h * 0.02 }} />
    </View>
  );
}

// progress ring that fills in once the scene appears
function MiniRing({ size, pct, children }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  const [t, setT] = React.useState(0);
  useEffect(() => {
    const id = v.addListener(({ value }) => setT(value));
    Animated.timing(v, { toValue: pct, duration: 1300, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, []);
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <SvgGradient id="mini" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.grad[0]} />
            <Stop offset="1" stopColor={c.grad[1]} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.border} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="url(#mini)" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circ * t} ${circ}`} rotation="-90" origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      {children}
    </View>
  );
}

// a bar that grows from its bottom edge (vertical) or its left edge (horizontal)
function Grow({ delay, size, vertical, style, children }) {
  const v = useIn(delay, 800);
  const t = vertical
    ? [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [size / 2, 0] }) }, { scaleY: v }]
    : [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-size / 2, 0] }) }, { scaleX: v }];
  return <Animated.View style={[style, { transform: t }]}>{children}</Animated.View>;
}

function Plan({ w }) {
  const { c } = useTheme();
  const rows = [
    ['Deep work', '4h', 0.82, c.brand],
    ['PR reviews', '1h 30m', 0.5, c.brand2],
    ['Meetings', '1h', 0.32, c.good],
  ];
  const barW = w - 28 - 112 - 16;
  return (
    <View style={{ width: w, paddingTop: 14 }}>
      <Mock>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Tile icon="sparkles" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Txt v="title" style={{ fontSize: 15 }}>Today's plan</Txt>
            <Txt v="small" color="dim" style={{ fontSize: 12 }}>Demo at 4pm, two PR reviews</Txt>
          </View>
          <View style={{ backgroundColor: tint(c.brand, 0.16), borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Txt v="small" w={700} color="brand" style={{ fontSize: 11 }}>AI</Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
          <MiniRing size={112} pct={0.72}>
            <Txt v="numSm" style={{ fontSize: 19, lineHeight: 22 }}>6h 50m</Txt>
            <Txt v="small" color="dim" style={{ fontSize: 11, lineHeight: 14 }}>of 9h 30m</Txt>
          </MiniRing>
          <View style={{ flex: 1, marginLeft: 16 }}>
            {rows.map(([label, hrs, f, col], i) => (
              <View key={label} style={{ marginTop: i ? 11 : 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt v="small" style={{ fontSize: 12, lineHeight: 15 }}>{label}</Txt>
                  <Txt v="small" color="dim" style={{ fontSize: 12, lineHeight: 15 }}>{hrs}</Txt>
                </View>
                <View style={{ height: 7, borderRadius: 4, backgroundColor: c.border, marginTop: 4, overflow: 'hidden' }}>
                  <Grow delay={350 + i * 150} size={barW * f} style={{ width: barW * f, height: 7, borderRadius: 4, backgroundColor: col }} />
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: tint(c.brand, 0.1), borderRadius: 14, padding: 11 }}>
          <Icon name="bulb" size={16} color="warn" />
          <Txt v="small" style={{ flex: 1, marginLeft: 8, fontSize: 12, lineHeight: 17 }}>Leave at 18:25 and you stay on pace for the month.</Txt>
        </View>
      </Mock>
      <Tag icon="trendUp" text="On pace" tone="good" delay={300} style={{ right: 8, top: 0 }} />
    </View>
  );
}

function Notif({ icon, title, body, buttons, delay, style, tone }) {
  const { c } = useTheme();
  const v = useIn(delay, 600);
  const wig = useLoop(260, 0);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }] }, style]}>
      <Mock>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Animated.View style={{ transform: [{ rotate: tone === 'ring' ? wig.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '10deg'] }) : '0deg' }] }}>
            <Tile icon={icon} size={30} colors={tone === 'good' ? ['#047857', '#34D399'] : undefined} />
          </Animated.View>
          <Txt v="small" color="dim" style={{ flex: 1, marginLeft: 9, fontSize: 12 }}>Hours Planner</Txt>
          <Txt v="small" color="faint" style={{ fontSize: 12 }}>now</Txt>
        </View>
        <Txt v="title" style={{ marginTop: 9, fontSize: 15 }}>{title}</Txt>
        <Txt v="small" color="dim" style={{ marginTop: 2, fontSize: 12, lineHeight: 17 }}>{body}</Txt>
        <View style={{ flexDirection: 'row', marginTop: 11 }}>
          {buttons.map(([label, hot]) => (
            <View key={label} style={{ marginRight: 8, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: hot ? c.brand : tint(c.brand, 0.14) }}>
              <Txt v="small" w={700} color={hot ? '#FFFFFF' : 'brand'} style={{ fontSize: 12, lineHeight: 15 }}>{label}</Txt>
            </View>
          ))}
        </View>
      </Mock>
    </Animated.View>
  );
}

function Alarm({ w }) {
  const { c } = useTheme();
  return (
    <View style={{ width: w, paddingTop: 6 }}>
      <View style={{ position: 'absolute', left: 18, right: 18, top: 0, height: 60, borderRadius: 22, backgroundColor: tint(c.surface, 0.6), borderWidth: 1, borderColor: c.border }} />
      <Notif icon="bellRing" tone="ring" title="Time to check in" body="Plan: leave by 18:25 to close 9h 30m today." buttons={[['Check in', true], ['Snooze']]} delay={0} style={{ marginTop: 12 }} />
      <Notif icon="check" tone="good" title="Checked in automatically" body="08:56 at the office. Wrong? Tap undo, no need to open the app." buttons={[['Undo', true]]} delay={650} style={{ marginTop: 12 }} />
    </View>
  );
}

function Office({ w, h }) {
  const { c } = useTheme();
  const s = Math.min(w, h);
  const mid = s / 2;
  const pulse = useRef(new Animated.Value(0)).current;
  const walk = useLoop(2600, 300);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const rr = s * 0.3;
  return (
    <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: s, height: s }}>
        <Svg width={s} height={s} style={{ position: 'absolute' }}>
          <Defs>
            <SvgGradient id="radar" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={c.grad[0]} stopOpacity="0.28" />
              <Stop offset="1" stopColor={c.grad[1]} stopOpacity="0.05" />
            </SvgGradient>
          </Defs>
          <Circle cx={mid} cy={mid} r={s * 0.46} fill="url(#radar)" />
          <Circle cx={mid} cy={mid} r={s * 0.46} stroke={tint(c.brand, 0.18)} strokeWidth={1.2} fill="none" />
          <Circle cx={mid} cy={mid} r={rr} stroke={c.brand2} strokeWidth={1.6} strokeDasharray="5 6" fill={tint(c.brand2, 0.08)} />
          <Circle cx={mid} cy={mid} r={s * 0.14} stroke={tint(c.brand, 0.2)} strokeWidth={1.2} fill="none" />
        </Svg>
        <Animated.View style={{ position: 'absolute', left: mid - rr, top: mid - rr, width: rr * 2, height: rr * 2, borderRadius: rr, borderWidth: 2, borderColor: c.brand2, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.45] }) }] }} />
        <View style={{ position: 'absolute', left: mid - 30, top: mid - 30 }}>
          <Tile icon="pin" size={60} />
        </View>
        <Animated.View style={{ position: 'absolute', left: mid + s * 0.3, top: mid + s * 0.28, transform: [{ translateX: walk.interpolate({ inputRange: [0, 1], outputRange: [0, -s * 0.23] }) }, { translateY: walk.interpolate({ inputRange: [0, 1], outputRange: [0, -s * 0.2] }) }] }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: tint(c.info, 0.25), alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: c.info, borderWidth: 2, borderColor: '#FFFFFF' }} />
          </View>
        </Animated.View>
      </View>
      <Tag icon="radar" text="Within 150 m" tone="brand2" style={{ left: 0, top: h * 0.06 }} />
      <Tag icon="check" text="Checked in 08:56" tone="good" delay={500} style={{ right: 0, bottom: h * 0.1 }} />
      <Tag icon="history" text="Undo anytime" tone="warn" delay={900} style={{ left: w * 0.04, bottom: h * 0.02 }} />
    </View>
  );
}

function Insight({ w }) {
  const { c } = useTheme();
  const days = [['M', 0.8], ['T', 0.95], ['W', 0.7], ['T', 1], ['F', 0.55]];
  const H = 108;
  return (
    <View style={{ width: w, paddingTop: 14 }}>
      <Mock>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="caption" color="faint">This week</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tint(c.good, 0.16), borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Icon name="trendUp" size={12} color="good" style={{ marginRight: 4 }} />
            <Txt v="small" w={700} color="good" style={{ fontSize: 11, lineHeight: 14 }}>+2h 10m</Txt>
          </View>
        </View>
        <View style={{ height: H + 22, marginTop: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 6 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 22 + H * 0.82, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: tint(c.warn, 0.7) }} />
          {days.map(([d, f], i) => (
            <View key={i} style={{ alignItems: 'center', width: (w - 28 - 12) / 5 - 8 }}>
              <View style={{ height: H, width: '100%', justifyContent: 'flex-end' }}>
                <Grow vertical delay={200 + i * 120} size={H * f} style={{ height: H * f, borderRadius: 9, overflow: 'hidden' }}>
                  <LinearGradient colors={i === 4 ? [tint(c.brand, 0.5), tint(c.brand2, 0.5)] : c.grad} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={{ flex: 1 }} />
                </Grow>
              </View>
              <Txt v="small" color={i === 4 ? 'brand' : 'faint'} w={700} style={{ fontSize: 11, marginTop: 6 }}>{d}</Txt>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: tint(c.brand, 0.1), borderRadius: 14, padding: 11 }}>
          <Tile icon="sparkles" size={28} />
          <Txt v="small" style={{ flex: 1, marginLeft: 9, fontSize: 12, lineHeight: 17 }}>You are 2h 10m ahead. Friday can end at 16:30.</Txt>
        </View>
      </Mock>
      <Tag icon="flame" text="Weekly review" tone="warn" delay={400} style={{ right: 8, top: 0 }} />
    </View>
  );
}

export function Scene({ kind = 'welcome', width = 320, height = 330 }) {
  if (kind === 'plan') return <Plan w={width} />;
  if (kind === 'alarm') return <Alarm w={width} />;
  if (kind === 'office') return <Office w={width} h={height} />;
  if (kind === 'insight') return <Insight w={width} />;
  return <Welcome w={width} h={height} />;
}
