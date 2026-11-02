// first run: an animated intro, then a short setup with permissions
import React, { useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Linking, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Hero } from '../art';
import { biometricReady, saveOfficeHere, todaysMeetings, unlockWithBiometrics } from '../device';
import { parseHM } from '../logic';
import { ensurePermission } from '../notify';
import { setGroqKey } from '../store';
import { Btn, Card, Field, Icon, Meter, Notice, Row, Txt, useTheme } from '../ui';

const SLIDES = [
  { kind: 'plan', title: 'Hit your hours without the math', text: 'Tell it your workload and get a daily plan that adds up to your monthly target.' },
  { kind: 'alarm', title: 'Alarms that know your day', text: 'Check in and check out alarms on the minute, hours done updates, and buttons right on the notification.' },
  { kind: 'office', title: 'Knows when you reach the office', text: 'Optional office detection asks you or records the time for you. A home screen widget keeps it one tap away.' },
  { kind: 'insight', title: 'See where your hours go', text: 'Charts, what if planning and an AI coach that only works from your real numbers.' },
];

function Logo() {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Icon name="timer" size={19} color="#FFFFFF" />
      </LinearGradient>
      <Txt v="title">Hours Planner</Txt>
    </View>
  );
}

function Intro({ onFinish }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const list = useRef(null);
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={[c.bg, c.bg2]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: insets.top + 14 }}>
        <Logo />
        {!last ? (
          <Pressable onPress={onFinish} hitSlop={12}>
            <Txt v="title" color="dim">Skip</Txt>
          </Pressable>
        ) : null}
      </View>

      <Animated.FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.kind}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => {
          const range = [(index - 1) * width, index * width, (index + 1) * width];
          return (
            <View style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
              <Animated.View style={{ transform: [{ translateX: x.interpolate({ inputRange: range, outputRange: [width * 0.3, 0, -width * 0.3] }) }], opacity: x.interpolate({ inputRange: range, outputRange: [0.2, 1, 0.2] }) }}>
                <Hero kind={item.kind} size={Math.min(width - 56, 330)} />
              </Animated.View>
              <Animated.View style={{ marginTop: 22, opacity: x.interpolate({ inputRange: range, outputRange: [0, 1, 0] }) }}>
                <Txt v="h1" align="center" style={{ fontSize: 28, lineHeight: 34 }}>{item.title}</Txt>
                <Txt v="body" color="dim" align="center" style={{ marginTop: 10 }}>{item.text}</Txt>
              </Animated.View>
            </View>
          );
        }}
      />

      <View style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
          {SLIDES.map((s, n) => {
            const range = [(n - 1) * width, n * width, (n + 1) * width];
            return (
              <Animated.View
                key={s.kind}
                style={{ width: 9, height: 9, borderRadius: 5, marginHorizontal: 4, backgroundColor: c.brand, opacity: x.interpolate({ inputRange: range, outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' }), transform: [{ scale: x.interpolate({ inputRange: range, outputRange: [0.8, 1.35, 0.8], extrapolate: 'clamp' }) }] }}
              />
            );
          })}
        </View>
        <Btn label={last ? 'Get started' : 'Next'} icon={last ? 'rocket' : 'arrowR'} onPress={() => (last ? onFinish() : list.current?.scrollToIndex({ index: i + 1 }))} />
      </View>
    </View>
  );
}

const STEPS = ['About you', 'Connect Groq', 'Permissions', 'Ready'];

function Setup({ settings, onDone, onBack }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: settings.name ?? '', target: String(settings.target), margin: String(settings.margin), start: settings.officialStart, end: settings.officialEnd, key: '' });
  const [extra, setExtra] = useState({});
  const [done, setDone] = useState({});
  const [err, setErr] = useState('');
  const set = (k) => (v) => {
    setErr('');
    setF((p) => ({ ...p, [k]: v }));
  };

  const next = () => {
    if (step === 0) {
      const t = Number(f.target);
      const m = Number(f.margin);
      if (!(t > 0) || !(m >= 0) || m >= t) return setErr('Check the target and margin.');
      if (parseHM(f.start) == null || parseHM(f.end) == null || parseHM(f.end) <= parseHM(f.start)) return setErr('Check the office times, like 09:00 and 18:00.');
    }
    setErr('');
    setStep(step + 1);
  };

  // each permission row does its own request and remembers the result
  const enable = async (id) => {
    setErr('');
    try {
      if (id === 'notif') {
        if (!(await ensurePermission())) throw new Error('Notifications are off. Without them the alarms cannot ring.');
      } else if (id === 'office') {
        const office = await saveOfficeHere();
        setExtra((p) => ({ ...p, office, geo: 'prompt' }));
      } else if (id === 'calendar') {
        await todaysMeetings();
        setExtra((p) => ({ ...p, calendar: true }));
      } else if (id === 'lock') {
        if (!(await biometricReady())) throw new Error('Set up a fingerprint or screen lock in Android settings first.');
        if (!(await unlockWithBiometrics())) throw new Error('Fingerprint did not match.');
        setExtra((p) => ({ ...p, lock: true }));
      }
      setDone((p) => ({ ...p, [id]: true }));
    } catch (e) {
      setErr(e.message);
    }
  };

  const finish = async () => {
    await setGroqKey(f.key.trim());
    onDone({ name: f.name.trim(), target: Number(f.target), margin: Number(f.margin), officialStart: f.start, officialEnd: f.end, onboarded: true, ...extra });
  };

  const perm = (id, icon, tone, title, sub, last) => (
    <Row
      icon={icon}
      tone={tone}
      title={title}
      sub={sub}
      last={last}
      right={done[id] ? <Icon name="checkCircle" size={24} color="good" /> : <Btn label="Enable" small kind="soft" onPress={() => enable(id)} />}
    />
  );

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <LinearGradient colors={[c.bg, c.bg2]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => (step === 0 ? onBack() : setStep(step - 1))} hitSlop={12} style={{ marginRight: 12 }}>
            <Icon name="chevronL" size={26} />
          </Pressable>
          <Txt v="small" color="dim" style={{ flex: 1 }}>Step {step + 1} of {STEPS.length}</Txt>
          <Txt v="small" w={700} color="brand">{STEPS[step]}</Txt>
        </View>
        <Meter value={step + 1} max={STEPS.length} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <View>
            <Txt v="h1">Let's set you up</Txt>
            <Txt v="body" color="dim" style={{ marginTop: 6, marginBottom: 20 }}>Your numbers drive every plan. You can change them later in Settings.</Txt>
            <Field label="What should I call you?" icon="user" value={f.name} onChangeText={set('name')} placeholder="Your name" />
            <View style={{ flexDirection: 'row' }}>
              <Field label="Monthly target (h)" icon="target" value={f.target} onChangeText={set('target')} keyboardType="numeric" style={{ flex: 1, marginRight: 10 }} />
              <Field label="Margin (h)" icon="hourglass" value={f.margin} onChangeText={set('margin')} keyboardType="numeric" style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Field label="Office starts" icon="sunrise" value={f.start} onChangeText={set('start')} keyboardType="numbers-and-punctuation" style={{ flex: 1, marginRight: 10 }} />
              <Field label="Office ends" icon="sunset" value={f.end} onChangeText={set('end')} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
            </View>
          </View>
        ) : step === 1 ? (
          <View>
            <Txt v="h1">Connect Groq</Txt>
            <Txt v="body" color="dim" style={{ marginTop: 6, marginBottom: 20 }}>Groq's free models plan your day from your workload. The key stays in secure storage on this phone.</Txt>
            <Field label="Groq API key" icon="key" value={f.key} onChangeText={set('key')} secureTextEntry placeholder="gsk_..." autoCapitalize="none" autoCorrect={false} />
            <Btn label="Get a free key" icon="link" kind="soft" onPress={() => Linking.openURL('https://console.groq.com/keys')} />
            <Notice tone="info" text="You can skip this. Without a key the planner uses an even split and everything else still works." />
          </View>
        ) : step === 2 ? (
          <View>
            <Txt v="h1">Allow the useful bits</Txt>
            <Txt v="body" color="dim" style={{ marginTop: 6, marginBottom: 14 }}>Only notifications matter for the alarms. The rest is optional.</Txt>
            <Card pad={4}>
              <View style={{ paddingHorizontal: 12 }}>
                {perm('notif', 'bellRing', 'brand', 'Alarms and reminders', 'Check in, check out and hours done alerts')}
                {perm('office', 'pin', 'brand2', 'Office detection', 'Stand at the office, then enable. Needs "Allow all the time"')}
                {perm('calendar', 'calendarDays', 'warn', 'Calendar', 'Meetings help the planner size your day')}
                {perm('lock', 'fingerprint', 'good', 'Fingerprint lock', 'Ask for your fingerprint when the app opens', true)}
              </View>
            </Card>
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <Hero kind="ready" size={300} />
            <Txt v="h1" align="center" style={{ marginTop: 8 }}>{f.name.trim() ? `You're set, ${f.name.trim()}` : "You're all set"}</Txt>
            <Txt v="body" color="dim" align="center" style={{ marginTop: 8 }}>Open the app, hit check in when you reach the office and tell it your workload.</Txt>
          </View>
        )}

        {err ? <Notice tone="bad" icon="info" text={err} /> : null}
        <View style={{ marginTop: 22 }}>
          {step < STEPS.length - 1 ? <Btn label={step === 1 && !f.key.trim() ? 'Skip for now' : 'Continue'} icon="arrowR" onPress={next} /> : <Btn label="Open Hours Planner" icon="rocket" onPress={finish} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function Onboarding({ settings, onDone }) {
  const [phase, setPhase] = useState('intro');
  return phase === 'intro' ? <Intro onFinish={() => setPhase('setup')} /> : <Setup settings={settings} onDone={onDone} onBack={() => setPhase('intro')} />;
}
