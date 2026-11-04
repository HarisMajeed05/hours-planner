import React, { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import * as Haptics from 'expo-haptics';
import { officeStatus, todaysMeetings } from '../device';
import { askGroq } from '../groq';
import { TYPES, clampToday, fmtH, fmtTime, parseKey, todayRange, typeOf } from '../logic';
import { Avatar, Btn, Card, CountUp, FadeIn, Field, Glass, HERO, Icon, Meter, Notice, Pill, Ring, Screen, Section, Segmented, SlideButton, Stat, Txt, tint, useTheme } from '../ui';

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDate = (k) => {
  const d = parseKey(k);
  return `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;
};
const TYPE_OPTIONS = [
  { id: 'work', label: 'Office', icon: 'briefcase' },
  { id: 'wfh', label: 'Home', icon: 'laptop' },
  { id: 'half', label: 'Half day', icon: 'sunMedium' },
  { id: 'leave', label: 'Leave', icon: 'palm' },
];
const greet = (h) => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');

const STATUS = {
  live: { label: 'Working', icon: 'activity', grad: HERO.work },
  today: { label: 'Not checked in', icon: 'clock', grad: HERO.work },
  break: { label: 'On a break', icon: 'coffee', grad: HERO.break },
  done: { label: 'Done for today', icon: 'checkCircle', grad: HERO.done },
  off: { label: 'Day off', icon: 'palm', grad: HERO.off },
  none: { label: 'No office today', icon: 'moon', grad: HERO.off },
};

// three small facts inside the hero card
function Fact({ icon, label, value }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Icon name={icon} size={16} color="rgba(255,255,255,0.8)" />
      <Txt v="small" color="rgba(255,255,255,0.75)" style={{ marginTop: 4, fontSize: 12 }}>{label}</Txt>
      <Txt v="title" color="#FFFFFF" style={{ marginTop: 1 }}>{value}</Txt>
    </View>
  );
}

export default function Today({ days, settings, account, stats, onCheckIn, onCheckOut, onFinish, onPatch, onEdit, onAuto, onSaveOffice, onProfile, onAuth, onSettings }) {
  const { c } = useTheme();
  const key = stats.todayKey;
  const day = days[key];
  const row = stats.rows.find((r) => r.key === key);
  const state = row?.state ?? 'none';
  const st = STATUS[state];

  // the auto check in toggle, it refuses (with a reason) until the office spot and permissions are in place
  async function toggleAuto(on) {
    setAutoMsg('');
    setAutoBad(false);
    try {
      await onAuto(on);
      Haptics.selectionAsync();
    } catch (e) {
      setAutoMsg(e.message);
      setAutoBad(true);
    }
  }

  function saveSpot() {
    Alert.alert('Save this spot as your office?', 'Only do this while you are standing at the office.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, I am here',
        onPress: async () => {
          try {
            await onSaveOffice();
            setAutoMsg('Office saved. Now switch on Auto check in.');
            setAutoBad(false);
          } catch (e) {
            setAutoMsg(e.message);
            setAutoBad(true);
          }
        },
      },
    ]);
  }

  async function whereAmI() {
    setAutoBad(false);
    setAutoMsg('Looking for you...');
    const r = await officeStatus(settings).catch(() => null);
    setAutoMsg(r ? `You are ${Math.round(r.dist)} m from the office, ${r.inside ? 'inside' : 'outside'} the ${settings.radius} m radius.` : 'No location fix yet. Step outside or try again in a moment.');
  }

  const left = Math.max(0, stats.todayPlan - stats.todayH);
  const perDay = stats.weightsLeft ? stats.needPerDay : 0;
  const dayType = typeOf(day);

  const [text, setText] = useState(day?.workload ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [listening, setListening] = useState(false);
  const spoken = useRef('');
  const [autoMsg, setAutoMsg] = useState('');
  const [autoBad, setAutoBad] = useState(false);
  const auto = settings.geo === 'auto';

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results?.[0]?.transcript;
    if (t) setText(spoken.current + t);
  });
  useSpeechRecognitionEvent('error', (e) => setErr(e.message || 'Voice input failed.'));

  async function mic() {
    setErr('');
    if (listening) return ExpoSpeechRecognitionModule.stop();
    const p = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!p.granted) return setErr('Microphone permission was denied.');
    spoken.current = text.trim() ? `${text.trim()} ` : '';
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
  }

  // ask Groq how long to stay today, then keep whatever it says inside the safe range
  async function planDay() {
    setBusy(true);
    setErr('');
    setNote('');
    const ctx = stats.planCtx;
    const range = todayRange(ctx.R, ctx.wT, ctx.sumW);
    const workload = text.trim();
    try {
      let meetings = [];
      if (settings.calendar) {
        try {
          meetings = await todaysMeetings();
        } catch (e) {
          setErr(e.message);
        }
      }
      const ai = await askGroq({
        model: settings.model,
        workload,
        meetings,
        ctx: { date: key, owed: ctx.R, daysLeft: stats.daysLeft, range, endMin: stats.endMin, typicalArrival: stats.typicalArrival, typicalH: stats.typicalH },
      });
      const hours = clampToday(ai.hours, ctx.R, ctx.wT, ctx.sumW);
      onPatch(key, { workload, plan: { hours, reason: ai.reason, tip: ai.tip, by: 'groq' } });
      if (meetings.length) setNote(`Counted ${meetings.length} meeting${meetings.length > 1 ? 's' : ''} from your calendar.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setErr(e.message);
      onPatch(key, { workload, plan: { hours: clampToday(range.equal, ctx.R, ctx.wT, ctx.sumW), reason: 'Even split, Groq was not used.', tip: '', by: 'fallback' } });
    } finally {
      setBusy(false);
    }
  }

  const tap = (fn) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fn();
  };

  const paceTone = stats.projected == null ? 'faint' : stats.projected >= stats.target ? 'good' : stats.projected >= stats.floor ? 'warn' : 'bad';
  const paceText = stats.projected == null ? 'Learning your pace' : stats.projected >= stats.target ? 'On pace' : stats.projected >= stats.floor ? 'Near the minimum' : 'Behind pace';

  return (
    <Screen>
      <FadeIn>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <Txt v="small" color="dim">{niceDate(key)}</Txt>
            <Txt v="h1">{greet(new Date().getHours())}{settings.name ? `, ${settings.name}` : ''}</Txt>
          </View>
          <Pressable onPress={onProfile} hitSlop={8}>
            <Avatar name={settings.name || 'H'} avatar={settings.avatar} />
          </Pressable>
        </View>
      </FadeIn>

      <FadeIn delay={60}>
        <View style={{ borderRadius: 32, marginBottom: 12, shadowColor: st.grad[0], shadowOpacity: 0.5, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 14 }}>
          <LinearGradient colors={st.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 32, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Pill label={st.label} icon={st.icon} solid />
              {row?.sessions?.length > 1 ? <Pill label={`${row.sessions.length} visits`} icon="layers" solid /> : null}
            </View>

            <Ring value={stats.todayH} max={stats.todayPlan} size={196} stroke={16} colors={['#FFFFFF', '#FFFFFF']} track="rgba(255,255,255,0.28)">
              <CountUp value={stats.todayH} format={fmtH} color="#FFFFFF" style={{ fontSize: 36, lineHeight: 42 }} />
              <Txt v="small" color="rgba(255,255,255,0.8)">{stats.todayPlan > 0 ? `of ${fmtH(stats.todayPlan)}` : TYPES[dayType].w === 0 ? TYPES[dayType].label : 'no plan'}</Txt>
            </Ring>

            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 20, paddingVertical: 12, marginTop: 18 }}>
              {state === 'live' ? (
                <>
                  <Fact icon="login" label="In" value={fmtTime(row.inMs)} />
                  <Fact icon="logout" label="Leave" value={fmtTime(row.planOutMs)} />
                  <Fact icon="hourglass" label="Left" value={fmtH(left)} />
                </>
              ) : state === 'today' ? (
                <>
                  <Fact icon="login" label="Suggested in" value={row?.planInMs ? fmtTime(row.planInMs) : '-'} />
                  <Fact icon="logout" label="Leave" value={row?.planOutMs ? fmtTime(row.planOutMs) : '-'} />
                  <Fact icon="target" label="Plan" value={fmtH(stats.todayPlan)} />
                </>
              ) : state === 'break' ? (
                <>
                  <Fact icon="login" label="First in" value={fmtTime(row.inMs)} />
                  <Fact icon="hourglass" label="Still to do" value={fmtH(left)} />
                  <Fact icon="target" label="Plan" value={fmtH(stats.todayPlan)} />
                </>
              ) : state === 'done' ? (
                <>
                  <Fact icon="login" label="In" value={row?.inMs ? fmtTime(row.inMs) : '-'} />
                  <Fact icon="logout" label="Out" value={row?.outMs ? fmtTime(row.outMs) : '-'} />
                  <Fact icon="clock" label="Total" value={fmtH(stats.todayH)} />
                </>
              ) : (
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Txt v="small" color="#FFFFFF">Enjoy the day. Check in only if you work today.</Txt>
                </View>
              )}
            </View>

            <View style={{ marginTop: 16 }}>
              {state === 'live' ? (
                <SlideButton label="Slide to check out" icon="logout" danger onComplete={onCheckOut} />
              ) : state === 'break' ? (
                <View>
                  <SlideButton label="Slide to check in again" icon="login" onComplete={onCheckIn} />
                  <Btn label="Finish the day here" kind="glass" small onPress={tap(onFinish)} style={{ marginTop: 10 }} />
                </View>
              ) : state === 'done' ? (
                <SlideButton label="Slide to check in again" icon="login" onComplete={onCheckIn} />
              ) : state === 'off' || state === 'none' ? (
                <SlideButton label="Slide to check in anyway" icon="login" onComplete={onCheckIn} />
              ) : (
                <SlideButton label="Slide to check in" icon="login" onComplete={onCheckIn} />
              )}
            </View>
          </LinearGradient>
        </View>
      </FadeIn>

      <FadeIn delay={100}>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Glass radius={24} pad={14} style={{ flex: 1.15, marginBottom: 0, marginRight: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: tint(c.brand2, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="radar" size={19} color="brand2" />
              </View>
              <Switch value={auto} onValueChange={toggleAuto} trackColor={{ false: c.border, true: tint(c.brand, 0.55) }} thumbColor={auto ? c.brand : c.faint} />
            </View>
            <Txt v="title" style={{ marginTop: 12 }}>Auto check in</Txt>
            <Txt v="small" color="dim" style={{ marginTop: 2 }}>
              {!settings.office ? 'Needs your office spot' : auto && day?.noAuto ? 'Paused for today' : auto ? `On, ${settings.radius} m radius` : 'Off'}
            </Txt>
            {!settings.office ? (
              <Pressable onPress={saveSpot} hitSlop={8} style={{ marginTop: 8 }}>
                <Txt v="small" w={700} color="brand">Save spot here</Txt>
              </Pressable>
            ) : auto && day?.noAuto ? (
              <Pressable onPress={() => onPatch(key, { noAuto: false })} hitSlop={8} style={{ marginTop: 8 }}>
                <Txt v="small" w={700} color="brand">Resume</Txt>
              </Pressable>
            ) : auto ? (
              <Pressable onPress={whereAmI} hitSlop={8} style={{ marginTop: 8 }}>
                <Txt v="small" w={700} color="brand">Where am I?</Txt>
              </Pressable>
            ) : null}
          </Glass>

          <Glass radius={24} pad={14} style={{ flex: 1, marginBottom: 0 }}>
            <View style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ring value={stats.worked} max={stats.target} size={92} stroke={10} colors={stats.worked >= stats.floor ? [c.good, c.brand2] : undefined}>
                <Txt v="numSm" style={{ fontSize: 18 }}>{Math.round((stats.worked / stats.target) * 100)}%</Txt>
              </Ring>
              <Txt v="small" color="dim" style={{ marginTop: 8 }}>of the month</Txt>
            </View>
          </Glass>
        </View>
        {autoMsg ? <Notice tone={autoBad ? 'bad' : 'info'} icon={autoBad ? 'info' : 'nav'} text={autoMsg} style={{ marginTop: 0, marginBottom: 12 }} /> : null}
      </FadeIn>

      <FadeIn delay={110}>
        {!account?.user && !settings.bannerDismissed ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: tint(c.brand2, 0.16), alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Icon name="cloud" size={20} color="brand2" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="title">Back up and sync your hours</Txt>
                <Txt v="small" color="dim" style={{ marginTop: 2 }}>Sign in and your hours survive a reinstall or a new phone.</Txt>
              </View>
              <Pressable onPress={() => onSettings({ bannerDismissed: true })} hitSlop={10}>
                <Icon name="x" size={18} color="faint" />
              </Pressable>
            </View>
            <Btn label="Sign in or create account" icon="login" kind="soft" small onPress={onAuth} style={{ marginTop: 12 }} />
          </Card>
        ) : null}
      </FadeIn>

      <FadeIn delay={120}>
        <Segmented options={TYPE_OPTIONS} value={dayType === 'holiday' ? 'leave' : dayType} onChange={(id) => onPatch(key, { type: id })} style={{ marginBottom: 12 }} />
      </FadeIn>

      {row?.sessions?.length ? (
        <FadeIn delay={160}>
          <Section title="Today's visits" right={<Pressable onPress={() => onEdit(key)}><Txt v="small" w={700} color="brand">Edit times</Txt></Pressable>} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {row.sessions.map((s, i) => (
              <View key={i} style={{ backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8 }}>
                <Txt v="small" color="dim">Visit {i + 1}</Txt>
                <Txt v="title">{fmtTime(s.in)} to {s.out ? fmtTime(s.out) : 'now'}</Txt>
              </View>
            ))}
          </ScrollView>
        </FadeIn>
      ) : (
        <Pressable onPress={() => onEdit(key)} style={{ alignSelf: 'flex-end', marginBottom: 6 }}>
          <Txt v="small" w={700} color="brand">Edit today's times</Txt>
        </Pressable>
      )}

      {stats.todayOpen ? (
        <FadeIn delay={200}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Icon name="sparkles" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Txt v="title">Plan your day</Txt>
                <Txt v="small" color="dim">{settings.calendar ? 'Your calendar is included' : 'Tell me what is on your plate'}</Txt>
              </View>
            </View>
            <Field multiline value={text} onChangeText={setText} placeholder="e.g. model demo at 4pm, two PR reviews, light otherwise" style={{ marginBottom: 12 }} />
            <View style={{ flexDirection: 'row' }}>
              <Btn label={listening ? 'Stop' : 'Speak'} icon={listening ? 'micOff' : 'mic'} kind="soft" onPress={mic} style={{ flex: 1, marginRight: 10 }} />
              <Btn label={busy ? 'Planning...' : day?.plan ? 'Plan again' : 'Plan with AI'} icon="wand" onPress={planDay} disabled={busy || (!text.trim() && !settings.calendar)} style={{ flex: 1.6 }} />
            </View>
            {err ? <Notice tone="warn" text={err} /> : null}
            {note ? <Txt v="small" color="dim" style={{ marginTop: 10 }}>{note}</Txt> : null}
            {day?.plan?.reason ? (
              <View style={{ flexDirection: 'row', backgroundColor: tint(c.brand, 0.1), borderRadius: 16, padding: 12, marginTop: 14 }}>
                <Icon name="bulb" size={18} color="brand" style={{ marginRight: 10, marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Txt v="small" w={600}>{day.plan.reason}</Txt>
                  {day.plan.tip ? <Txt v="small" color="dim" style={{ marginTop: 4 }}>{day.plan.tip}</Txt> : null}
                </View>
              </View>
            ) : null}
          </Card>
        </FadeIn>
      ) : stats.next ? (
        <FadeIn delay={200}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Icon name="calendarDays" size={20} color="brand" style={{ marginRight: 10 }} />
              <Txt v="title">Next working day, {niceDate(stats.next.key)}</Txt>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Stat icon="login" label="Check in" value={fmtTime(stats.next.planInMs)} tone="brand" />
              <View style={{ width: 10 }} />
              <Stat icon="logout" label="Leave" value={fmtTime(stats.next.planOutMs)} tone="bad" />
              <View style={{ width: 10 }} />
              <Stat icon="clock" label="Hours" value={fmtH(stats.next.hours)} tone="good" />
            </View>
          </Card>
        </FadeIn>
      ) : null}

      <FadeIn delay={240}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt v="title">This month</Txt>
            <Pill label={paceText} icon={stats.projected == null ? 'gauge' : stats.projected >= stats.floor ? 'trendUp' : 'trendDown'} tone={paceTone} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 }}>
            <Txt v="num" style={{ fontSize: 38, lineHeight: 44 }}>{fmtH(stats.worked)}</Txt>
            <Txt v="small" color="dim" style={{ marginBottom: 8, marginLeft: 8 }}>of {stats.target}h</Txt>
          </View>
          <Meter value={stats.worked} max={stats.target} marker={stats.floor} colors={stats.worked >= stats.floor ? [c.good, c.brand2] : undefined} />
          <Txt v="small" color="faint">The orange tick is your safe minimum, {stats.floor}h.</Txt>
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            <Stat icon="hourglass" label="Left to target" value={fmtH(stats.remaining)} sub={`${fmtH(stats.toFloor)} to the minimum`} tone="warn" />
            <View style={{ width: 10 }} />
            <Stat icon="calendarDays" label="Working days left" value={String(stats.daysLeft)} sub={`${fmtH(perDay)} per day`} tone={perDay > 9.5 ? 'bad' : 'brand'} />
          </View>
          {stats.projected != null ? <Txt v="small" color="dim" style={{ marginTop: 12 }}>At your usual pace you finish on {fmtH(stats.projected)}.</Txt> : null}
          {stats.tooHeavy ? <Notice tone="bad" text="The target now needs days longer than 12h. Worth talking to HR about the shortfall." /> : null}
        </Card>
      </FadeIn>
    </Screen>
  );
}
