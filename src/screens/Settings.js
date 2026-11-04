import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { biometricReady, officeStatus, todaysMeetings, unlockWithBiometrics } from '../device';
import { parseHM } from '../logic';
import { notifyNow } from '../notify';
import { KINDS, SOUNDS, channelFor, soundPrefs } from '../sounds';
import { getGroqKey, setGroqKey } from '../store';
import { Btn, Card, Chip, FadeIn, Field, Icon, Notice, Pill, Row, Screen, Segmented, Sheet, Txt, tint, useKeyboard, useTheme } from '../ui';
import { AccountCard } from './Account';

const MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
const THEMES = [
  { id: 'system', label: 'Phone', icon: 'phone' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'light', label: 'Light', icon: 'sun' },
];

const PKG = 'com.hoursplanner.app';

// one player at a time for the sound preview
let player = null;
const stopPreview = () => {
  try {
    player?.remove();
  } catch {}
  player = null;
};
const preview = (src) => {
  stopPreview();
  try {
    player = createAudioPlayer(src);
    player.play();
  } catch {}
};

// pick the sound, vibration and priority for one kind of notification, with a preview and a test
function SoundSheet({ kind, settings, onPatch, onClose }) {
  const { c } = useTheme();
  const K = KINDS[kind];
  const prefs = soundPrefs(settings)[kind];
  const set = (patch) => onPatch({ sounds: { ...soundPrefs(settings), [kind]: { ...prefs, ...patch } } });
  useEffect(() => stopPreview, []);

  const openSystem = () =>
    Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: PKG },
      { key: 'android.provider.extra.CHANNEL_ID', value: channelFor(kind, settings).id },
    ]).catch(() => Linking.openSettings());

  return (
    <Sheet onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: tint(c[K.tone], 0.16), alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Icon name={K.icon} size={21} color={K.tone} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="h2">{K.label}</Txt>
            <Txt v="small" color="dim">{K.sub}</Txt>
          </View>
        </View>

        {SOUNDS.map((snd) => {
          const on = prefs.sound === snd.id;
          return (
            <Pressable
              key={snd.id}
              onPress={() => {
                set({ sound: snd.id });
                if (snd.src) preview(snd.src);
                else stopPreview();
              }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 16, marginBottom: 6, borderWidth: 1.5, borderColor: on ? c.brand : c.border, backgroundColor: on ? tint(c.brand, 0.12) : c.surfaceHi }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? c.brand : c.faint, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.brand }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="title" style={{ fontSize: 15 }}>{snd.label}</Txt>
                <Txt v="small" color="dim">{snd.sub}</Txt>
              </View>
              {snd.src ? <Icon name="play" size={18} color={on ? 'brand' : 'faint'} /> : null}
            </Pressable>
          );
        })}

        <View style={{ marginTop: 8 }}>
          <Row icon="zap" tone="warn" title="Vibrate" right={<Switch value={prefs.vibrate} onValueChange={(v) => set({ vibrate: v })} trackColor={{ false: c.border, true: tint(c.brand, 0.55) }} thumbColor={prefs.vibrate ? c.brand : c.faint} />} last={kind === 'alarm'} />
          {kind !== 'alarm' ? (
            <View style={{ paddingTop: 12 }}>
              <Txt v="small" color="dim" style={{ marginBottom: 8 }}>Priority</Txt>
              <Segmented options={[{ id: 'default', label: 'Quiet', icon: 'bell' }, { id: 'high', label: 'Pop up', icon: 'bellRing' }]} value={prefs.priority} onChange={(id) => set({ priority: id })} />
            </View>
          ) : (
            <Txt v="small" color="faint" style={{ marginTop: 10 }}>Alarms always use the highest priority and the alarm volume.</Txt>
          )}
        </View>

        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <Btn label="Send a test" icon="bell" kind="soft" small onPress={() => notifyNow(kind, `Test: ${K.label}`, 'This is how it will sound.')} style={{ flex: 1, marginRight: 10 }} />
          <Btn label="Android settings" icon="settings" kind="ghost" small onPress={openSystem} style={{ flex: 1 }} />
        </View>
        <Txt v="small" color="faint" style={{ marginTop: 10 }}>Android keeps sound, vibration and priority per channel. Changing them here makes a fresh channel, so anything you changed in Android settings starts over. Use "Android settings" to fine tune the current one.</Txt>
        <Btn label="Done" onPress={onClose} style={{ marginTop: 16 }} />
      </ScrollView>
    </Sheet>
  );
}

const typed = (s) => ({ model: s.model, target: String(s.target), margin: String(s.margin), officialStart: s.officialStart, officialEnd: s.officialEnd, plannerAt: s.plannerAt, radius: String(s.radius) });

// toggles and choices apply at once, typed values show a save button
export default function Settings({ settings, account, onPatch, onData, onAuto, onSaveOffice, onProfile, onAuth }) {
  const { c } = useTheme();
  const kb = useKeyboard();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState(typed(settings));
  const [key, setKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState('');
  const [soundKind, setSoundKind] = useState(null);

  useEffect(() => {
    getGroqKey().then((k) => {
      setKey(k);
      setSavedKey(k);
    });
  }, []);

  const dirty = JSON.stringify(f) !== JSON.stringify(typed(settings)) || key !== savedKey;
  const set = (k) => (v) => {
    setMsg('');
    setF((p) => ({ ...p, [k]: v }));
  };

  const save = async () => {
    const target = Number(f.target);
    const margin = Number(f.margin);
    const radius = Number(f.radius);
    if (!(target > 0) || !(margin >= 0) || margin >= target) return setMsg('Target and margin are not valid numbers.');
    if (!(radius >= 100)) return setMsg('Office radius should be at least 100 metres.');
    if ([f.officialStart, f.officialEnd, f.plannerAt].some((t) => parseHM(t) == null)) return setMsg('Times must look like 09:00.');
    if (parseHM(f.officialEnd) <= parseHM(f.officialStart)) return setMsg('Office end has to be after office start.');
    await setGroqKey(key.trim());
    setSavedKey(key.trim());
    onPatch({ model: f.model.trim(), target, margin, radius, officialStart: f.officialStart, officialEnd: f.officialEnd, plannerAt: f.plannerAt });
    setMsg('');
  };

  const toggleLock = async (on) => {
    if (!on) return onPatch({ lock: false });
    if (!(await biometricReady())) return setInfo('Set up a fingerprint or screen lock in Android settings first.');
    if (await unlockWithBiometrics()) onPatch({ lock: true });
  };

  const toggleCalendar = async (on) => {
    if (!on) return onPatch({ calendar: false });
    try {
      await todaysMeetings();
      onPatch({ calendar: true });
      setInfo('');
    } catch (e) {
      setInfo(e.message);
    }
  };

  const toggleAuto = async (on) => {
    setInfo('');
    try {
      await onAuto(on);
    } catch (e) {
      setInfo(e.message);
    }
  };

  const saveOffice = () => {
    Alert.alert('Save this spot as your office?', 'Only do this while you are standing at the office.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, I am here',
        onPress: async () => {
          try {
            setInfo('Getting your location...');
            await onSaveOffice();
            setInfo('Office saved. Now switch on Auto check in and out.');
          } catch (e) {
            setInfo(e.message);
          }
        },
      },
    ]);
  };

  const whereAmI = async () => {
    setInfo('Looking for you...');
    const r = await officeStatus(settings).catch(() => null);
    setInfo(r ? `You are ${Math.round(r.dist)} m from the office, ${r.inside ? 'inside' : 'outside'} the ${settings.radius} m radius.` : 'No location fix yet, or no office saved.');
  };

  const checkUpdate = async () => {
    if (!Updates.isEnabled) return setInfo('Updates are not set up in this build yet.');
    try {
      setInfo('Checking...');
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) return setInfo('You have the latest version.');
      await Updates.fetchUpdateAsync();
      Alert.alert('Update ready', 'Restart the app to use it.', [{ text: 'Later' }, { text: 'Restart', onPress: () => Updates.reloadAsync() }]);
      setInfo('Update downloaded.');
    } catch (e) {
      setInfo(e.message);
    }
  };

  const sw = (value, onChange) => <Switch value={value} onValueChange={onChange} trackColor={{ false: c.border, true: tint(c.brand, 0.55) }} thumbColor={value ? c.brand : c.faint} />;

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Settings" sub="Make it yours" contentStyle={{ paddingBottom: 190 }}>

        <FadeIn>
          <AccountCard account={account} settings={settings} onProfile={onProfile} onAuth={onAuth} />
        </FadeIn>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Icon name="sparkles" size={20} color="brand" style={{ marginRight: 10 }} />
            <Txt v="title">AI planner</Txt>
          </View>
          <Field
            label="Groq API key"
            icon="key"
            value={key}
            onChangeText={(v) => {
              setMsg('');
              setKey(v);
            }}
            secureTextEntry={!showKey}
            placeholder="gsk_..."
            autoCapitalize="none"
            autoCorrect={false}
            right={
              <Pressable onPress={() => setShowKey(!showKey)} hitSlop={10}>
                <Icon name={showKey ? 'eyeOff' : 'eye'} size={19} color="faint" />
              </Pressable>
            }
          />
          <Txt v="small" color="dim" style={{ marginBottom: 8 }}>Model</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {MODELS.map((m) => (
              <Chip key={m} label={m.replace('openai/', '')} on={f.model === m} onPress={() => set('model')(m)} />
            ))}
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Icon name="target" size={20} color="good" style={{ marginRight: 10 }} />
            <Txt v="title">Hours</Txt>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Field label="Monthly target (h)" value={f.target} onChangeText={set('target')} keyboardType="numeric" style={{ flex: 1, marginRight: 10 }} />
            <Field label="Margin (h)" value={f.margin} onChangeText={set('margin')} keyboardType="numeric" style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Field label="Office start" icon="sunrise" value={f.officialStart} onChangeText={set('officialStart')} keyboardType="numbers-and-punctuation" style={{ flex: 1, marginRight: 10, marginBottom: 0 }} />
            <Field label="Office end" icon="sunset" value={f.officialEnd} onChangeText={set('officialEnd')} keyboardType="numbers-and-punctuation" style={{ flex: 1, marginBottom: 0 }} />
          </View>
        </Card>

        <Card>
          <Row icon="bellRing" tone="brand" title="Alarms and reminders" sub="Check in, check out and hours done" right={sw(settings.alarms, (v) => onPatch({ alarms: v }))} last />
          <Field label="Weekday workload reminder" icon="bell" value={f.plannerAt} onChangeText={set('plannerAt')} keyboardType="numbers-and-punctuation" style={{ marginTop: 10, marginBottom: 0 }} />
        </Card>

        <Card pad={4}>
          <View style={{ paddingHorizontal: 12 }}>
            {Object.entries(KINDS).map(([kind, K], i, all) => {
              const p = soundPrefs(settings)[kind];
              const snd = SOUNDS.find((x) => x.id === p.sound);
              return (
                <Row
                  key={kind}
                  icon={K.icon}
                  tone={K.tone}
                  title={`${K.label} sound`}
                  sub={`${snd?.label ?? p.sound}${p.vibrate ? ', vibrates' : ''}`}
                  onPress={() => setSoundKind(kind)}
                  right={<Icon name="chevronR" size={18} color="faint" />}
                  last={i === all.length - 1}
                />
              );
            })}
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="pin" size={20} color="brand2" style={{ marginRight: 10 }} />
              <Txt v="title">Office detection</Txt>
            </View>
            <Pill label={settings.office ? 'Spot saved' : 'No spot yet'} tone={settings.office ? 'good' : 'faint'} icon={settings.office ? 'check' : 'info'} />
          </View>
          <Row icon="radar" tone="brand2" title="Auto check in and out" sub={`Checks you in inside ${settings.radius} m of the office and out when you leave`} right={sw(settings.geo === 'auto', toggleAuto)} last={settings.geo === 'auto'} />
          {settings.geo !== 'auto' ? <Row icon="bell" tone="warn" title="Only remind me" sub="A notification with a button when you arrive or leave" right={sw(settings.geo === 'prompt', (v) => onPatch({ geo: v ? 'prompt' : 'off' }))} last /> : null}
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <Btn label={settings.office ? 'Move office' : 'Save my spot'} icon="nav" kind="soft" small onPress={saveOffice} style={{ flex: 1, marginRight: 10 }} />
            <Btn label="Where am I?" icon="radar" kind="ghost" small onPress={whereAmI} style={{ flex: 1 }} />
          </View>
          <Field label="Radius (metres)" value={f.radius} onChangeText={set('radius')} keyboardType="numeric" style={{ marginTop: 14, marginBottom: 0 }} />
          <Txt v="small" color="faint" style={{ marginTop: 8 }}>Phones need at least 100 m to detect the edge reliably. It works with the screen off, so set location to "Allow all the time".</Txt>
        </Card>

        <Card>
          <Row icon="calendarDays" tone="warn" title="Read today's meetings" sub="Titles and times go to Groq when you plan" right={sw(settings.calendar, toggleCalendar)} />
          <Row icon="fingerprint" tone="good" title="Fingerprint lock" sub="Ask when the app opens" right={sw(settings.lock, toggleLock)} last />
        </Card>

        <Card>
          <Txt v="title" style={{ marginBottom: 12 }}>Appearance</Txt>
          <Segmented options={THEMES} value={settings.theme} onChange={(id) => onPatch({ theme: id })} />
        </Card>

        <Card pad={4}>
          <View style={{ paddingHorizontal: 12 }}>
            <Row icon="database" tone="brand" title="Data tools" sub="Export, backup, restore, import from HRM" onPress={onData} right={<Icon name="chevronR" size={18} color="faint" />} />
            <Row icon="refresh" tone="brand2" title="Check for updates" sub="Small fixes arrive over the air" onPress={checkUpdate} right={<Icon name="chevronR" size={18} color="faint" />} last />
          </View>
        </Card>

        {info ? <Notice tone="info" text={info} /> : null}
        <Txt v="small" color="faint" align="center" style={{ marginTop: 18 }}>Hours Planner · everything stays on this phone except what you send to Groq.</Txt>
      </Screen>

      {soundKind ? <SoundSheet kind={soundKind} settings={settings} onPatch={onPatch} onClose={() => setSoundKind(null)} /> : null}

      {dirty ? (
        <View style={{ position: 'absolute', left: 18, right: 18, bottom: kb ? 12 : insets.bottom + 98 }}>
          {msg ? <Notice tone="bad" text={msg} style={{ marginTop: 0, marginBottom: 8 }} /> : null}
          <Btn label="Save changes" icon="check" onPress={save} />
        </View>
      ) : null}
    </View>
  );
}
