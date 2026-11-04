// first run: a branded welcome and four live slides, then a short setup with permissions
import React, { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand, Scene } from '../art';
import { biometricReady, saveOfficeHere, todaysMeetings, unlockWithBiometrics } from '../device';
import { parseHM } from '../logic';
import { ensurePermission } from '../notify';
import { setGroqKey } from '../store';
import { FONT } from '../theme';
import { Aurora, Btn, Card, FadeIn, Field, Icon, Notice, Row, Txt, tint, useTheme } from '../ui';

// the second part of every title is painted in the brand colour
const SLIDES = [
  { kind: 'welcome', a: 'Your office hours,', b: 'on autopilot', text: 'Plan the day, hit 198 hours a month and stop doing attendance math in your head.' },
  { kind: 'plan', a: 'Hit your hours', b: 'without the math', text: 'Tell it your workload and get a daily plan that adds up to your monthly target.' },
  { kind: 'alarm', a: 'Alarms that', b: 'know your day', text: 'Check in and check out alarms on the minute, with buttons right on the notification.' },
  { kind: 'office', a: 'Knows when you', b: 'reach the office', text: 'It checks you in and out by location, tells you, and one tap undoes a wrong guess.' },
  { kind: 'insight', a: 'See where', b: 'your hours go', text: 'Charts, what if planning and a coach that only works from your real numbers.' },
];

function Logo() {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
        <Icon name="timer" size={18} color="#FFFFFF" />
      </LinearGradient>
      <Txt v="title">Hours Planner</Txt>
    </View>
  );
}

function Intro({ onFinish, onSignIn }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const list = useRef(null);
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  // the scene shrinks on short phones so the text and the buttons always fit
  const sceneW = Math.min(width - 48, 340);
  const boxH = Math.min(350, height * 0.38);
  const sceneH = Math.min(sceneW, boxH);
  // every slide gets the same box so the title sits at the same height on all of them, taller scenes shrink to fit it
  const NATURAL = { plan: 270, alarm: 340, insight: 260 };
  const fit = (kind) => (NATURAL[kind] ? Math.min(1, boxH / NATURAL[kind]) : 1);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={[c.bg, c.bg2]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <Aurora />
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
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: true, listener: (e) => setI(Math.round(e.nativeEvent.contentOffset.x / width)) })}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => {
          const range = [(index - 1) * width, index * width, (index + 1) * width];
          return (
            <View style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
              <Animated.View
                style={{
                  width: sceneW,
                  height: boxH,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: x.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' }),
                  transform: [
                    { translateX: x.interpolate({ inputRange: range, outputRange: [width * 0.35, 0, -width * 0.35] }) },
                    { scale: x.interpolate({ inputRange: range, outputRange: [0.86 * fit(item.kind), fit(item.kind), 0.86 * fit(item.kind)], extrapolate: 'clamp' }) },
                  ],
                }}
              >
                {/* only the slide you are on is built, so its animation plays when you arrive */}
                {i === index ? (
                  <FadeIn>
                    <Scene kind={item.kind} width={sceneW} height={sceneH} />
                  </FadeIn>
                ) : null}
              </Animated.View>
              <Animated.View style={{ marginTop: 26, opacity: x.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' }), transform: [{ translateY: x.interpolate({ inputRange: range, outputRange: [24, 0, 24], extrapolate: 'clamp' }) }] }}>
                <Txt v="h1" align="center" style={{ fontSize: 29, lineHeight: 35 }}>
                  {item.a}
                  {'\n'}
                  <Text style={{ color: c.brand }}>{item.b}</Text>
                </Txt>
                <Txt v="body" color="dim" align="center" style={{ marginTop: 10, paddingHorizontal: 6 }}>{item.text}</Txt>
              </Animated.View>
            </View>
          );
        }}
      />

      <View style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 18 }}>
          {SLIDES.map((s, n) => {
            const range = [(n - 1) * width, n * width, (n + 1) * width];
            return (
              <Animated.View
                key={s.kind}
                style={{ width: 26, height: 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: c.brand, opacity: x.interpolate({ inputRange: range, outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' }), transform: [{ scaleX: x.interpolate({ inputRange: range, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' }) }] }}
              />
            );
          })}
        </View>
        <Btn label={last ? 'Get started' : 'Continue'} icon={last ? 'rocket' : 'arrowR'} onPress={() => {
          if (last) return onFinish();
          setI(i + 1);
          list.current?.scrollToIndex({ index: i + 1 });
        }} />
        <Pressable onPress={onSignIn} hitSlop={10} style={{ alignSelf: 'center', paddingTop: 16, paddingBottom: 2 }}>
          <Txt v="small" color="dim">
            Already use Hours Planner? <Text style={{ color: c.brand, fontFamily: FONT[700] }}>Sign in</Text>
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

const STEPS = [
  { name: 'About you', icon: 'user' },
  { name: 'Connect Groq', icon: 'bot' },
  { name: 'Permissions', icon: 'shield' },
  { name: 'Ready', icon: 'rocket' },
];

// the four pills at the top, each one fills when its step is reached
function Steps({ step }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', marginTop: 14 }}>
      {STEPS.map((s, n) => (
        <View key={s.name} style={{ flex: 1, height: 5, borderRadius: 3, marginRight: n < STEPS.length - 1 ? 6 : 0, backgroundColor: n <= step ? c.brand : c.border }} />
      ))}
    </View>
  );
}

// big icon tile, title and a line under it, the top of every setup step
function StepHead({ icon, title, sub }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: c.brand, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
        <Icon name={icon} size={26} color="#FFFFFF" />
      </LinearGradient>
      <Txt v="h1" style={{ fontSize: 28, lineHeight: 34 }}>{title}</Txt>
      <Txt v="body" color="dim" style={{ marginTop: 6 }}>{sub}</Txt>
    </View>
  );
}

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
        setExtra((p) => ({ ...p, office, geo: 'auto' }));
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

  const target = Number(f.target);
  const margin = Number(f.margin);
  const floor = target > 0 && margin >= 0 && margin < target ? target - margin : null;
  const on = (v) => (v ? 'On' : 'Off');

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <LinearGradient colors={[c.bg, c.bg2]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <Aurora />
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => (step === 0 ? onBack() : setStep(step - 1))} hitSlop={12} style={{ marginRight: 12 }}>
            <Icon name="chevronL" size={26} />
          </Pressable>
          <Txt v="small" color="dim" style={{ flex: 1 }}>Step {step + 1} of {STEPS.length}</Txt>
          <Txt v="small" w={700} color="brand">{STEPS[step].name}</Txt>
        </View>
        <Steps step={step} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <FadeIn key={step}>
          {step === 0 ? (
            <View>
              <StepHead icon="user" title="Let's set you up" sub="Your numbers drive every plan. You can change them later in Settings." />
              <Field label="What should I call you?" icon="user" value={f.name} onChangeText={set('name')} placeholder="Your name" />
              <View style={{ flexDirection: 'row' }}>
                <Field label="Monthly target (h)" icon="target" value={f.target} onChangeText={set('target')} keyboardType="numeric" style={{ flex: 1, marginRight: 10 }} />
                <Field label="Margin (h)" icon="hourglass" value={f.margin} onChangeText={set('margin')} keyboardType="numeric" style={{ flex: 1 }} />
              </View>
              <View style={{ flexDirection: 'row' }}>
                <Field label="Office starts" icon="sunrise" value={f.start} onChangeText={set('start')} keyboardType="numbers-and-punctuation" style={{ flex: 1, marginRight: 10 }} />
                <Field label="Office ends" icon="sunset" value={f.end} onChangeText={set('end')} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
              </View>
              {floor != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tint(c.brand, 0.12), borderRadius: 16, padding: 14 }}>
                  <Icon name="shield" size={20} color="brand" />
                  <Txt v="small" style={{ flex: 1, marginLeft: 10 }}>
                    Safe minimum is <Text style={{ fontFamily: FONT[700] }}>{floor}h</Text>. Anything between {floor}h and {target}h still counts as a good month.
                  </Txt>
                </View>
              ) : null}
            </View>
          ) : step === 1 ? (
            <View>
              <StepHead icon="bot" title="Connect Groq" sub="Groq's free models plan your day from your workload. The key stays in secure storage on this phone." />
              <Field label="Groq API key" icon="key" value={f.key} onChangeText={set('key')} secureTextEntry placeholder="gsk_..." autoCapitalize="none" autoCorrect={false} />
              <Btn label="Get a free key" icon="link" kind="soft" onPress={() => Linking.openURL('https://console.groq.com/keys')} />
              <Notice tone="info" text="You can skip this. Without a key the planner uses an even split and everything else still works." />
            </View>
          ) : step === 2 ? (
            <View>
              <StepHead icon="shield" title="Allow the useful bits" sub="Only notifications matter for the alarms. The rest is optional." />
              <Card pad={4}>
                <View style={{ paddingHorizontal: 12 }}>
                  {perm('notif', 'bellRing', 'brand', 'Alarms and reminders', 'Check in, check out and hours done alerts')}
                  {perm('office', 'radar', 'brand2', 'Auto check in and out', 'Stand at the office, then enable. Needs "Allow all the time"')}
                  {perm('calendar', 'calendarDays', 'warn', 'Calendar', 'Meetings help the planner size your day')}
                  {perm('lock', 'fingerprint', 'good', 'Fingerprint lock', 'Ask for your fingerprint when the app opens', true)}
                </View>
              </Card>
            </View>
          ) : (
            <View>
              <Brand size={84} icon="check" />
              <Txt v="h1" align="center" style={{ marginTop: 4, fontSize: 28, lineHeight: 34 }}>{f.name.trim() ? `You're set, ${f.name.trim()}` : "You're all set"}</Txt>
              <Txt v="body" color="dim" align="center" style={{ marginTop: 8, marginBottom: 20 }}>Here is what the app starts with.</Txt>
              <Card pad={4}>
                <View style={{ paddingHorizontal: 12 }}>
                  <Row icon="target" tone="brand" title="Monthly target" sub={`${f.target}h with ${f.margin}h margin`} />
                  <Row icon="clock" tone="brand2" title="Office hours" sub={`${f.start} to ${f.end}, Monday to Friday`} />
                  <Row icon="bot" tone="brand" title="Groq planner" sub={f.key.trim() ? 'Connected' : 'Skipped, even split plans'} />
                  <Row icon="bellRing" tone="warn" title="Alarms" sub={on(done.notif)} />
                  <Row icon="radar" tone="good" title="Auto check in" sub={on(extra.geo === 'auto')} last />
                </View>
              </Card>
            </View>
          )}
        </FadeIn>

        {err ? <Notice tone="bad" icon="info" text={err} /> : null}
        <View style={{ marginTop: 22 }}>
          {step < STEPS.length - 1 ? <Btn label={step === 1 && !f.key.trim() ? 'Skip for now' : 'Continue'} icon="arrowR" onPress={next} /> : <Btn label="Open Hours Planner" icon="rocket" onPress={finish} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function Onboarding({ settings, account, onDone, onSignIn }) {
  const [phase, setPhase] = useState('intro');
  // signing in on a new phone brings the name and numbers back, so go straight to the setup with them filled in
  useEffect(() => {
    if (account?.user) setPhase('setup');
  }, [account?.user?.id]);
  return phase === 'intro' ? <Intro onFinish={() => setPhase('setup')} onSignIn={onSignIn} /> : <Setup key={`${account?.user?.id ?? 'local'}:${settings.name}:${settings.target}:${settings.margin}`} settings={settings} onDone={onDone} onBack={() => setPhase('intro')} />;
}
