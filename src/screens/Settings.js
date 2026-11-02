import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import * as Updates from 'expo-updates';
import { biometricReady, saveOfficeHere, todaysMeetings, unlockWithBiometrics } from '../device';
import { parseHM } from '../logic';
import { getGroqKey, setGroqKey } from '../store';
import { Avatar, Btn, Card, Chip, FadeIn, Field, Icon, Notice, Pill, Row, Screen, ScreenHeader, Segmented, Txt, tint, useKeyboard, useTheme } from '../ui';

const MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
const GEO = [
  { id: 'off', label: 'Off', icon: 'x' },
  { id: 'prompt', label: 'Ask me', icon: 'bell' },
  { id: 'auto', label: 'Automatic', icon: 'zap' },
];
const THEMES = [
  { id: 'system', label: 'Phone', icon: 'phone' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'light', label: 'Light', icon: 'sun' },
];

const typed = (s) => ({ name: s.name ?? '', model: s.model, target: String(s.target), margin: String(s.margin), officialStart: s.officialStart, officialEnd: s.officialEnd, plannerAt: s.plannerAt, radius: String(s.radius) });

// toggles and choices apply at once, typed values show a save button
export default function Settings({ settings, onPatch, onData }) {
  const { c } = useTheme();
  const kb = useKeyboard();
  const [f, setF] = useState(typed(settings));
  const [key, setKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState('');

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
    onPatch({ name: f.name.trim(), model: f.model.trim(), target, margin, radius, officialStart: f.officialStart, officialEnd: f.officialEnd, plannerAt: f.plannerAt });
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

  const saveOffice = async () => {
    try {
      setInfo('Getting your location...');
      const office = await saveOfficeHere();
      onPatch({ office, geo: settings.geo === 'off' ? 'prompt' : settings.geo });
      setInfo('Office saved. Stand somewhere else and tap again to move it.');
    } catch (e) {
      setInfo(e.message);
    }
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
      <Screen contentStyle={{ paddingBottom: 190 }}>
        <ScreenHeader title="Settings" sub="Make it yours" />

        <FadeIn>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <Avatar name={f.name || 'H'} size={52} />
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Txt v="h2">{f.name.trim() || 'Your name'}</Txt>
                <Txt v="small" color="dim">{settings.target}h a month, {settings.margin}h margin</Txt>
              </View>
            </View>
            <Field label="Name" icon="user" value={f.name} onChangeText={set('name')} placeholder="What should I call you?" style={{ marginBottom: 0 }} />
          </Card>
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

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="pin" size={20} color="brand2" style={{ marginRight: 10 }} />
              <Txt v="title">Office detection</Txt>
            </View>
            <Pill label={settings.office ? 'Spot saved' : 'No spot yet'} tone={settings.office ? 'good' : 'faint'} icon={settings.office ? 'check' : 'info'} />
          </View>
          <Txt v="small" color="dim" style={{ marginBottom: 12 }}>The phone notices when you reach or leave the office. "Ask me" sends a notification with a button, "Automatic" records the time for you.</Txt>
          <Segmented options={GEO} value={settings.geo} onChange={(id) => onPatch({ geo: id })} style={{ marginBottom: 12 }} />
          <Btn label={settings.office ? 'Move the office to where I stand' : 'Save my current spot as the office'} icon="nav" kind="soft" small onPress={saveOffice} />
          <Field label="Radius (metres)" value={f.radius} onChangeText={set('radius')} keyboardType="numeric" style={{ marginTop: 14, marginBottom: 0 }} />
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

      {dirty ? (
        <View style={{ position: 'absolute', left: 18, right: 18, bottom: kb ? 12 : 104 }}>
          {msg ? <Notice tone="bad" text={msg} style={{ marginTop: 0, marginBottom: 8 }} /> : null}
          <Btn label="Save changes" icon="check" onPress={save} />
        </View>
      ) : null}
    </View>
  );
}
