// the component kit: cards, buttons, fields, rows, the ring, the floating tab bar, bottom sheets and the day editor
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { Hero } from './art';
import { Icon } from './icons';
import { TYPES, at, fmtMin, minOfDay, parseHM, parseKey, sessionsOf, typeOf } from './logic';
import { Txt, tint, useTheme } from './theme';

export { ThemeProvider, Txt, useTheme, tint, HERO } from './theme';
export { Icon } from './icons';

export const TYPE_ICON = { work: 'briefcase', wfh: 'laptop', half: 'sunMedium', leave: 'palm', holiday: 'party' };

export function useKeyboard() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return open;
}

// ---------- layout ----------

// a screen with the soft background gradient and room for the floating tab bar
export function Screen({ children, scroll = true, contentStyle }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={[c.bg, c.bg2]} style={StyleSheet.absoluteFill} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ padding: 18, paddingTop: insets.top + 14, paddingBottom: 130 }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingTop: insets.top + 14 }, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

export function ScreenHeader({ title, sub, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Txt v="h1">{title}</Txt>
        {sub ? <Txt v="small" color="dim" style={{ marginTop: 2 }}>{sub}</Txt> : null}
      </View>
      {right}
    </View>
  );
}

export function Section({ title, right, style }) {
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 10 }, style]}>
      <Txt v="caption" color="faint">{title}</Txt>
      {right}
    </View>
  );
}

export function Card({ children, style, pad = 16, onPress }) {
  const { c, shadow } = useTheme();
  const base = [{ backgroundColor: c.surface, borderRadius: 22, padding: pad, borderWidth: 1, borderColor: c.border, marginBottom: 12 }, shadow, style];
  return onPress ? (
    <Pressable onPress={onPress} style={base}>
      {children}
    </Pressable>
  ) : (
    <View style={base}>{children}</View>
  );
}

// slides and fades its children in once, delay staggers a column of cards
export function FadeIn({ delay = 0, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}>{children}</Animated.View>
  );
}

// ---------- controls ----------

export function Btn({ label, icon, onPress, kind = 'primary', disabled, loading, small, style }) {
  const { c } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to) => Animated.spring(scale, { toValue: to, speed: 40, bounciness: 0, useNativeDriver: true }).start();
  const h = small ? 44 : 54;
  const fg = kind === 'primary' || kind === 'danger' ? '#FFFFFF' : kind === 'white' ? '#3B2BB5' : kind === 'glass' ? '#FFFFFF' : kind === 'soft' ? c.brand : c.text;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {icon ? <Icon name={icon} size={small ? 18 : 20} color={fg} style={{ marginRight: 8 }} /> : null}
      <Txt v="title" color={fg} style={{ fontSize: small ? 14 : 16 }}>{loading ? 'Please wait...' : label}</Txt>
    </View>
  );
  const shape = { height: h, borderRadius: small ? 14 : 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 };
  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }, style]}>
      <Pressable onPress={onPress} disabled={disabled || loading} onPressIn={() => press(0.97)} onPressOut={() => press(1)}>
        {kind === 'primary' || kind === 'danger' ? (
          <LinearGradient colors={kind === 'danger' ? ['#E11D48', '#FB7185'] : c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={shape}>
            {body}
          </LinearGradient>
        ) : (
          <View
            style={[
              shape,
              kind === 'white' && { backgroundColor: '#FFFFFF' },
              kind === 'glass' && { backgroundColor: 'rgba(255,255,255,0.2)' },
              kind === 'soft' && { backgroundColor: tint(c.brand, 0.14) },
              kind === 'ghost' && { borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceHi },
            ]}
          >
            {body}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function Chip({ label, icon, on, onPress }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingVertical: 9, paddingHorizontal: 14, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: on ? c.brand : c.border, backgroundColor: on ? tint(c.brand, 0.16) : c.surfaceHi }}
    >
      {icon ? <Icon name={icon} size={16} color={on ? 'brand' : 'dim'} style={{ marginRight: 6 }} /> : null}
      <Txt v="small" w={600} color={on ? 'brand' : 'dim'}>{label}</Txt>
    </Pressable>
  );
}

// equal width options in one rounded track
export function Segmented({ options, value, onChange, style }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: c.surfaceHi, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: c.border }, style]}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} onPress={() => onChange(o.id)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: on ? tint(c.brand, 0.18) : 'transparent' }}>
            {o.icon ? <Icon name={o.icon} size={17} color={on ? 'brand' : 'faint'} /> : null}
            <Txt v="small" w={600} color={on ? 'brand' : 'dim'} style={{ marginTop: o.icon ? 3 : 0, fontSize: 12 }}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Pill({ label, icon, tone = 'brand', solid, style }) {
  const { c } = useTheme();
  const col = solid ? '#FFFFFF' : (c[tone] ?? tone);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: solid ? 'rgba(255,255,255,0.22)' : tint(c[tone] ?? tone, 0.15) }, style]}>
      {icon ? <Icon name={icon} size={13} color={col} style={{ marginRight: 5 }} /> : null}
      <Txt v="small" w={700} color={col} style={{ fontSize: 12, lineHeight: 16 }}>{label}</Txt>
    </View>
  );
}

export function Field({ label, icon, right, multiline, style, inputStyle, ...input }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Txt v="small" color="dim" style={{ marginBottom: 6 }}>{label}</Txt> : null}
      <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', backgroundColor: c.surfaceHi, borderRadius: 16, borderWidth: 1.5, borderColor: focus ? c.brand : c.border, paddingHorizontal: 14 }}>
        {icon ? <Icon name={icon} size={18} color={focus ? 'brand' : 'faint'} style={{ marginRight: 10, marginTop: multiline ? 14 : 0 }} /> : null}
        <TextInput
          {...input}
          multiline={multiline}
          onFocus={(e) => {
            setFocus(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            input.onBlur?.(e);
          }}
          placeholderTextColor={c.faint}
          style={[{ flex: 1, color: c.text, fontFamily: 'Inter_500Medium', fontSize: 15, paddingVertical: 14, minHeight: multiline ? 92 : 50, textAlignVertical: multiline ? 'top' : 'center' }, inputStyle]}
        />
        {right}
      </View>
    </View>
  );
}

// a line in a settings list: icon tile, text and something on the right
export function Row({ icon, tone = 'brand', title, sub, right, onPress, last }) {
  const { c } = useTheme();
  const col = c[tone] ?? tone;
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: tint(col, 0.14), alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Icon name={icon} size={19} color={col} />
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Txt v="title" style={{ fontSize: 15 }}>{title}</Txt>
        {sub ? <Txt v="small" color="dim" style={{ marginTop: 1 }}>{sub}</Txt> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

export function Stat({ icon, label, value, sub, tone = 'brand' }) {
  const { c, shadow } = useTheme();
  const col = c[tone] ?? tone;
  return (
    <View style={[{ flex: 1, backgroundColor: c.surface, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: c.border }, shadow]}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: tint(col, 0.14), alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon name={icon} size={17} color={col} />
      </View>
      <Txt v="small" color="dim" numberOfLines={1}>{label}</Txt>
      <Txt v="numSm" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2 }}>{value}</Txt>
      {sub ? <Txt v="small" color="faint" numberOfLines={2} style={{ marginTop: 2, fontSize: 12, lineHeight: 15 }}>{sub}</Txt> : null}
    </View>
  );
}

export function Notice({ tone = 'info', icon = 'info', text, style }) {
  const { c } = useTheme();
  const col = c[tone] ?? tone;
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: tint(col, 0.12), borderRadius: 14, padding: 12, borderWidth: 1, borderColor: tint(col, 0.3), marginTop: 10 }, style]}>
      <Icon name={icon} size={17} color={col} style={{ marginRight: 10, marginTop: 1 }} />
      <Txt v="small" style={{ flex: 1, color: col }}>{text}</Txt>
    </View>
  );
}

// a gradient progress bar, marker draws a tick like the safe minimum
export function Meter({ value, max, marker, colors }) {
  const { c } = useTheme();
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 700, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={{ marginVertical: 12 }}>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: c.border, overflow: 'hidden' }}>
        <Animated.View style={{ height: 12, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}>
          <LinearGradient colors={colors ?? c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 6 }} />
        </Animated.View>
      </View>
      {marker != null && max > 0 ? <View style={{ position: 'absolute', left: `${Math.min(1, marker / max) * 100}%`, top: -3, width: 2, height: 18, backgroundColor: c.warn, borderRadius: 1 }} /> : null}
    </View>
  );
}

// the round progress meter, it animates whenever the value moves
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export function Ring({ value, max, size = 200, stroke = 16, colors, track, children }) {
  const { c } = useTheme();
  const id = useRef(`ring${Math.random().toString(36).slice(2, 8)}`).current;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct]);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });
  const [g1, g2] = colors ?? c.grad;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={g1} />
            <Stop offset="1" stopColor={g2} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} rotation="-90" origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      {children}
    </View>
  );
}

export function Avatar({ name, size = 44 }) {
  const { c } = useTheme();
  const letter = (name || '?').trim()[0]?.toUpperCase() ?? '?';
  return (
    <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Txt v="title" color="#FFFFFF" style={{ fontSize: size * 0.4 }}>{letter}</Txt>
    </LinearGradient>
  );
}

// ---------- navigation ----------

// floating bar with a pill that slides under the active tab. it hides while the keyboard is open
export function TabBar({ tabs, value, onChange }) {
  const { c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const kb = useKeyboard();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const idx = Math.max(0, tabs.findIndex((t) => t.id === value));
  const cell = w / tabs.length;
  useEffect(() => {
    if (w) Animated.spring(x, { toValue: idx * cell, speed: 18, bounciness: 6, useNativeDriver: true }).start();
  }, [idx, w]);
  if (kb) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 14, bottom: insets.bottom + 10 }}>
      <View style={[{ height: 68, borderRadius: 28, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, flexDirection: 'row', padding: 6 }, shadow, { shadowOpacity: 0.18, elevation: 10 }]} onLayout={(e) => setW(e.nativeEvent.layout.width - 12)}>
        {w > 0 ? (
          <Animated.View style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: cell, borderRadius: 22, backgroundColor: tint(c.brand, 0.16), transform: [{ translateX: x }] }} />
        ) : null}
        {tabs.map((t) => {
          const on = t.id === value;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                if (!on) Haptics.selectionAsync();
                onChange(t.id);
              }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name={t.icon} size={22} color={on ? 'brand' : 'faint'} stroke={on ? 2.3 : 2} />
              <Txt v="small" w={on ? 700 : 500} color={on ? 'brand' : 'faint'} style={{ fontSize: 11, lineHeight: 14, marginTop: 3 }}>{t.label}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------- sheets ----------

export function Sheet({ onClose, children }) {
  const { c } = useTheme();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: 28, maxHeight: '90%', borderWidth: 1, borderColor: c.border }}>
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: 16 }} />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const toHM = (ms) => (ms == null ? '' : fmtMin(minOfDay(new Date(ms))));

// fix a day: its type and every check in / check out
export function DayEditor({ dayKey, day, onSave, onClose }) {
  const { c } = useTheme();
  const [type, setType] = useState('work');
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!dayKey) return;
    setType(typeOf(day));
    setRows(sessionsOf(day).map((x) => ({ a: toHM(x.in), b: toHM(x.out) })));
    setErr('');
  }, [dayKey]);

  if (!dayKey) return null;
  const setRow = (i, k, v) => setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const submit = () => {
    const out = [];
    let prevEnd = -1;
    for (let i = 0; i < rows.length; i++) {
      const a = parseHM(rows[i].a);
      const b = rows[i].b.trim() ? parseHM(rows[i].b) : null;
      if (a == null || (rows[i].b.trim() && b == null)) return setErr('Use the 24 hour format, like 09:20');
      if (b != null && b <= a) return setErr('Check out has to be after check in');
      if (a < prevEnd) return setErr('Sessions cannot overlap');
      if (b == null && i < rows.length - 1) return setErr('Only the last session can be open');
      prevEnd = b ?? 24 * 60;
      out.push({ in: at(dayKey, a).getTime(), out: b == null ? null : at(dayKey, b).getTime() });
    }
    onSave(dayKey, { type, sessions: out });
  };

  return (
    <Sheet onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Txt v="h2">{parseKey(dayKey).toDateString()}</Txt>
        <Txt v="small" color="dim" style={{ marginTop: 2, marginBottom: 14 }}>Pick what kind of day it was, then fix the times.</Txt>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
          {Object.entries(TYPES).map(([id, t]) => {
            const on = type === id;
            return (
              <Pressable key={id} onPress={() => setType(id)} style={{ width: '33.33%', padding: 4 }}>
                <View style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, borderColor: on ? c.brand : c.border, backgroundColor: on ? tint(c.brand, 0.14) : c.surfaceHi }}>
                  <Icon name={TYPE_ICON[id]} size={22} color={on ? 'brand' : 'dim'} />
                  <Txt v="small" w={600} color={on ? 'brand' : 'dim'} style={{ marginTop: 5, fontSize: 12 }}>{t.label}</Txt>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Txt v="caption" color="faint" style={{ marginTop: 18, marginBottom: 8 }}>Check ins and check outs</Txt>
        {rows.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Field icon="login" value={r.a} onChangeText={(v) => setRow(i, 'a', v)} placeholder="09:20" keyboardType="numbers-and-punctuation" style={{ flex: 1, marginBottom: 10 }} />
            <View style={{ width: 8 }} />
            <Field icon="logout" value={r.b} onChangeText={(v) => setRow(i, 'b', v)} placeholder="still in" keyboardType="numbers-and-punctuation" style={{ flex: 1, marginBottom: 10 }} />
            <Pressable onPress={() => setRows((p) => p.filter((_, j) => j !== i))} style={{ padding: 10, marginBottom: 10 }}>
              <Icon name="x" size={20} color="bad" />
            </Pressable>
          </View>
        ))}
        <Btn label="Add a session" icon="plus" kind="soft" small onPress={() => setRows((p) => [...p, { a: '', b: '' }])} />
        <Txt v="small" color="faint" style={{ marginTop: 8 }}>Leave the last check out empty if you are still in.</Txt>

        {err ? <Notice tone="bad" icon="info" text={err} /> : null}
        <View style={{ flexDirection: 'row', marginTop: 18 }}>
          <Btn label="Cancel" kind="ghost" onPress={onClose} style={{ flex: 1, marginRight: 10 }} />
          <Btn label="Save day" icon="check" onPress={submit} style={{ flex: 1.4 }} />
        </View>
      </ScrollView>
    </Sheet>
  );
}

// shown over everything until the fingerprint matches
export function LockScreen({ onUnlock }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <Hero kind="lock" size={280} />
      <Txt v="h1" style={{ marginTop: 8 }}>Hours Planner</Txt>
      <Txt v="body" color="dim" align="center" style={{ marginTop: 6, marginBottom: 28 }}>Your hours are locked. Use your fingerprint or screen lock to open the app.</Txt>
      <Btn label="Unlock" icon="fingerprint" onPress={onUnlock} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}
