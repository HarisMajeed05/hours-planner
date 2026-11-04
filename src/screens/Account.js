// sign in, create account, forgot password, cloud setup, and the profile screen with avatar editing
import React, { useState } from 'react';
import { Alert, Linking, Pressable, Share, View } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { SETUP_SQL, changePassword, deleteCloudData, getConfig, resetWithCode, saveConfig, sendResetCode, setAvatarPhoto, setAvatarPreset, setName, signIn, signOut, signUp, syncNow, testCloud } from '../account';
import { Brand } from '../art';
import { AVATAR_PRESETS, Avatar, Btn, Card, FadeIn, Field, Icon, Notice, Pill, Row, Screen, Segmented, Sheet, Txt, useTheme } from '../ui';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const agoText = (ms) => {
  if (!ms) return 'not yet';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 24 * 60) return `${Math.round(m / 60)} h ago`;
  return new Date(ms).toDateString();
};

function Back({ onPress, title, sub }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
      <Pressable onPress={onPress} hitSlop={12} style={{ marginRight: 12 }}>
        <Icon name="chevronL" size={28} />
      </Pressable>
      {title ? (
        <View style={{ flex: 1 }}>
          <Txt v="h1">{title}</Txt>
          {sub ? <Txt v="small" color="dim">{sub}</Txt> : null}
        </View>
      ) : null}
    </View>
  );
}

// the password box with a show and hide eye
function PasswordField({ label, value, onChangeText, placeholder = 'At least 8 characters' }) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label}
      icon="key"
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={!show}
      placeholder={placeholder}
      autoCapitalize="none"
      autoCorrect={false}
      right={
        <Pressable onPress={() => setShow(!show)} hitSlop={10}>
          <Icon name={show ? 'eyeOff' : 'eye'} size={19} color="faint" />
        </Pressable>
      }
    />
  );
}

// ---------- cloud setup ----------

function CloudSetup({ onDone }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ tone: 'info', text: '' });

  React.useEffect(() => {
    getConfig().then((c) => {
      setUrl(c.url);
      setKey(c.key);
    });
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg({ tone: 'info', text: '' });
    try {
      await saveConfig({ url, key });
      await testCloud();
      setMsg({ tone: 'good', text: 'Connected. The cloud is ready.' });
      setTimeout(onDone, 700);
    } catch (e) {
      setMsg({ tone: 'bad', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const step = (n, text) => (
    <View style={{ flexDirection: 'row', marginBottom: 10 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(124,92,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Txt v="small" w={700} color="brand" style={{ fontSize: 12, lineHeight: 15 }}>{n}</Txt>
      </View>
      <Txt v="small" style={{ flex: 1 }}>{text}</Txt>
    </View>
  );

  return (
    <View>
      <Brand size={64} icon="cloud" />
      <Txt v="h1" align="center" style={{ marginTop: -6 }}>Connect your cloud</Txt>
      <Txt v="body" color="dim" align="center" style={{ marginTop: 6, marginBottom: 18 }}>Your hours are stored in a free Supabase project that only you own. Setup takes about 5 minutes, once.</Txt>

      <Card>
        {step('1', 'Create a free project at supabase.com.')}
        {step('2', 'Open SQL Editor, paste the setup SQL and press Run.')}
        {step('3', 'Authentication, Sign In / Providers, Email: switch off "Confirm email" so new accounts can sign in right away.')}
        {step('4', 'Project Settings, API: copy the Project URL and the anon or publishable key below.')}
        <Btn label="Share the setup SQL" icon="share" kind="soft" small onPress={() => Share.share({ message: SETUP_SQL, title: 'Hours Planner Supabase setup' }).catch(() => {})} style={{ marginTop: 4 }} />
        <Btn label="Open supabase.com" icon="link" kind="ghost" small onPress={() => Linking.openURL('https://supabase.com/dashboard')} style={{ marginTop: 8 }} />
      </Card>

      <Field label="Project URL" icon="link" value={url} onChangeText={setUrl} placeholder="https://abcdefgh.supabase.co" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <Field label="Anon or publishable key" icon="key" value={key} onChangeText={setKey} placeholder="Paste the key" autoCapitalize="none" autoCorrect={false} />
      {msg.text ? <Notice tone={msg.tone} icon={msg.tone === 'good' ? 'checkCircle' : 'info'} text={msg.text} style={{ marginTop: 0, marginBottom: 14 }} /> : null}
      <Btn label={busy ? 'Testing...' : 'Save and test'} icon="check" onPress={save} disabled={busy || !url.trim() || !key.trim()} />
    </View>
  );
}

// ---------- sign in ----------

export function AuthScreen({ account, onClose }) {
  const [setup, setSetup] = useState(!account.configured);
  React.useEffect(() => {
    if (account.configured) setSetup(false);
  }, [account.configured]);
  const [mode, setMode] = useState('signin'); // signin | signup | forgot
  const [codeSent, setCodeSent] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', code: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ tone: 'bad', text: '' });
  const set = (k) => (v) => {
    setMsg({ tone: 'bad', text: '' });
    setF((p) => ({ ...p, [k]: v }));
  };
  const fail = (text) => setMsg({ tone: 'bad', text });

  const run = async (fn) => {
    setBusy(true);
    setMsg({ tone: 'bad', text: '' });
    try {
      await fn();
    } catch (e) {
      fail(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!EMAIL.test(f.email.trim())) return fail('Enter a valid email address.');
    if (mode === 'forgot') {
      if (!codeSent) {
        return run(async () => {
          await sendResetCode(f.email);
          setCodeSent(true);
          setMsg({ tone: 'good', text: 'We sent a 6 digit code to your email.' });
        });
      }
      if (f.code.trim().length < 6) return fail('Enter the 6 digit code from the email.');
      if (f.password.length < 8) return fail('The new password needs at least 8 characters.');
      return run(async () => {
        await resetWithCode({ email: f.email, code: f.code, password: f.password });
        onClose();
      });
    }
    if (f.password.length < 8) return fail('The password needs at least 8 characters.');
    if (mode === 'signup') {
      if (!f.name.trim()) return fail('Add your name.');
      return run(async () => {
        const r = await signUp({ email: f.email, password: f.password, name: f.name });
        if (r.needsConfirm) {
          setMode('signin');
          setMsg({ tone: 'good', text: 'Account created. Open the email we sent, confirm it, then sign in here.' });
        } else onClose();
      });
    }
    return run(async () => {
      await signIn({ email: f.email, password: f.password });
      onClose();
    });
  };

  const title = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Welcome back';

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20 }}>
      <Screen contentStyle={{ paddingBottom: 60 }}>
        <Back onPress={() => (setup && account.configured ? setSetup(false) : onClose())} title={setup ? 'Cloud setup' : undefined} />
        {setup ? (
          <CloudSetup onDone={() => setSetup(false)} />
        ) : (
          <FadeIn>
            <View style={{ marginTop: -26, marginBottom: -4 }}>
              <Brand size={64} icon={mode === 'forgot' ? 'key' : 'cloud'} />
            </View>
            <Txt v="h1" align="center" style={{ fontSize: 28, lineHeight: 34, marginTop: -8 }}>{title}</Txt>
            <Txt v="body" color="dim" align="center" style={{ marginTop: 6, marginBottom: 14 }}>
              {mode === 'forgot' ? 'We email you a code to set a new password.' : mode === 'signup' ? 'One account keeps your hours safe and in sync.' : 'Sign in to get your hours back on this phone.'}
            </Txt>
            <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
              <Pill label="Any phone" icon="phone" tone="brand2" style={{ marginHorizontal: 4, marginBottom: 6 }} />
              <Pill label="Private to you" icon="lock" tone="good" style={{ marginHorizontal: 4, marginBottom: 6 }} />
              <Pill label="Free" icon="sparkles" tone="brand" style={{ marginHorizontal: 4, marginBottom: 6 }} />
            </View>

            {mode !== 'forgot' ? (
              <Segmented options={[{ id: 'signin', label: 'Sign in', icon: 'login' }, { id: 'signup', label: 'Create account', icon: 'user' }]} value={mode} onChange={(m) => { setMode(m); setMsg({ tone: 'bad', text: '' }); }} style={{ marginBottom: 16 }} />
            ) : null}

            {mode === 'signup' ? <Field label="Your name" icon="user" value={f.name} onChangeText={set('name')} placeholder="What should I call you?" /> : null}
            <Field label="Email" icon="mail" value={f.email} onChangeText={set('email')} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
            {mode === 'forgot' && codeSent ? <Field label="6 digit code" icon="shield" value={f.code} onChangeText={set('code')} placeholder="123456" keyboardType="number-pad" /> : null}
            {mode !== 'forgot' || codeSent ? <PasswordField label={mode === 'forgot' ? 'New password' : 'Password'} value={f.password} onChangeText={set('password')} /> : null}

            {msg.text ? <Notice tone={msg.tone} icon={msg.tone === 'good' ? 'checkCircle' : 'info'} text={msg.text} style={{ marginTop: 0, marginBottom: 14 }} /> : null}
            <Btn label={busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? (codeSent ? 'Set new password' : 'Send code') : 'Sign in'} icon={mode === 'forgot' ? 'key' : 'login'} onPress={submit} disabled={busy} />

            <View style={{ alignItems: 'center', marginTop: 18 }}>
              {mode === 'signin' ? (
                <Pressable onPress={() => { setMode('forgot'); setCodeSent(false); setMsg({ tone: 'bad', text: '' }); }} hitSlop={8}>
                  <Txt v="small" w={700} color="brand">Forgot password?</Txt>
                </Pressable>
              ) : mode === 'forgot' ? (
                <Pressable onPress={() => { setMode('signin'); setMsg({ tone: 'bad', text: '' }); }} hitSlop={8}>
                  <Txt v="small" w={700} color="brand">Back to sign in</Txt>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setSetup(true)} hitSlop={8} style={{ marginTop: 14 }}>
                <Txt v="small" color="faint">Cloud project settings</Txt>
              </Pressable>
            </View>
          </FadeIn>
        )}
      </Screen>
    </View>
  );
}

// ---------- profile ----------

// picks a photo, shrinks it to 320 px and hands the base64 to the account module
async function pickPhoto(source) {
  if (source === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new Error('Camera permission was denied.');
  }
  const opts = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const ctx = ImageManipulator.manipulate(res.assets[0].uri, { maxWidth: 1024 });
  ctx.resize({ width: 320 });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  return out.base64;
}

function AvatarSheet({ settings, onClose, onMsg }) {
  const { c } = useTheme();
  const [styles, setStyles] = useState(false);
  const [busy, setBusy] = useState(false);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (e) {
      onMsg({ tone: 'warn', text: e.message });
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const photo = (source) =>
    act(async () => {
      const b64 = await pickPhoto(source);
      if (b64) await setAvatarPhoto(b64);
    });

  return (
    <Sheet onClose={onClose}>
      <Txt v="h2" style={{ marginBottom: 14 }}>{styles ? 'Pick a style' : 'Profile picture'}</Txt>
      {styles ? (
        <View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
            {AVATAR_PRESETS.map((_, id) => {
              const on = settings.avatar?.type === 'preset' && settings.avatar.id === id;
              return (
                <Pressable key={id} onPress={() => act(() => setAvatarPreset(id))} style={{ width: '33.33%', alignItems: 'center', paddingVertical: 10 }}>
                  <View style={{ padding: 3, borderRadius: 40, borderWidth: 2, borderColor: on ? c.brand : 'transparent' }}>
                    <Avatar name={settings.name} size={68} avatar={{ type: 'preset', id }} />
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Btn label="Back" kind="ghost" onPress={() => setStyles(false)} style={{ marginTop: 10 }} />
        </View>
      ) : (
        <View>
          <Row icon="camera" tone="brand" title="Take a photo" onPress={() => !busy && photo('camera')} right={<Icon name="chevronR" size={18} color="faint" />} />
          <Row icon="image" tone="brand2" title="Choose from gallery" onPress={() => !busy && photo('gallery')} right={<Icon name="chevronR" size={18} color="faint" />} />
          <Row icon="palette" tone="warn" title="Pick a style" sub="Colourful avatar with your first letter" onPress={() => setStyles(true)} right={<Icon name="chevronR" size={18} color="faint" />} last={settings.avatar?.type !== 'photo' && settings.avatar?.type !== 'url'} />
          {settings.avatar?.type === 'photo' || settings.avatar?.type === 'url' ? <Row icon="trash" tone="bad" title="Remove photo" onPress={() => !busy && act(() => setAvatarPreset(0))} last /> : null}
          {busy ? <Txt v="small" color="dim" style={{ marginTop: 10 }}>Working on it...</Txt> : null}
        </View>
      )}
    </Sheet>
  );
}

function PasswordSheet({ onClose, onMsg }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (pw.length < 8) return setErr('Use at least 8 characters.');
    setBusy(true);
    try {
      await changePassword(pw);
      onMsg({ tone: 'good', text: 'Password changed.' });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet onClose={onClose}>
      <Txt v="h2" style={{ marginBottom: 14 }}>Change password</Txt>
      <PasswordField label="New password" value={pw} onChangeText={(v) => { setErr(''); setPw(v); }} />
      {err ? <Notice tone="bad" text={err} style={{ marginTop: 0, marginBottom: 12 }} /> : null}
      <View style={{ flexDirection: 'row' }}>
        <Btn label="Cancel" kind="ghost" onPress={onClose} style={{ flex: 1, marginRight: 10 }} />
        <Btn label={busy ? 'Saving...' : 'Save'} icon="check" onPress={submit} disabled={busy} style={{ flex: 1.3 }} />
      </View>
    </Sheet>
  );
}

export function ProfileScreen({ account, settings, onClose, onAuth }) {
  const { c } = useTheme();
  const [name, setNameText] = useState(settings.name ?? '');
  const [sheet, setSheet] = useState(null); // avatar | password
  const [msg, setMsg] = useState({ tone: 'info', text: '' });
  const [busy, setBusy] = useState(false);
  const signed = !!account.user;
  const changed = name.trim() !== (settings.name ?? '');

  const run = async (fn, ok) => {
    setBusy(true);
    setMsg({ tone: 'info', text: '' });
    try {
      await fn();
      if (ok) setMsg({ tone: 'good', text: ok });
    } catch (e) {
      setMsg({ tone: 'warn', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const saveName = () => run(() => setName(name), 'Name saved.');

  const askSignOut = () =>
    Alert.alert('Sign out?', 'Your hours stay on this phone unless you also clear them. The cloud copy is never touched.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => run(() => signOut()) },
      { text: 'Sign out and clear this phone', style: 'destructive', onPress: () => run(() => signOut({ clear: true }).then(onClose)) },
    ]);

  const askDelete = () =>
    Alert.alert('Delete your cloud data?', 'This removes your profile, picture and backed up hours from the cloud. Your hours on this phone stay. The login itself is removed from the Supabase dashboard.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run(() => deleteCloudData(), 'Cloud data deleted.') },
    ]);

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20 }}>
      <Screen contentStyle={{ paddingBottom: 60 }}>
        <Back onPress={onClose} title="Profile" sub={signed ? 'Signed in' : 'On this phone only'} />

        <FadeIn>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Pressable onPress={() => setSheet('avatar')}>
              <Avatar name={settings.name} size={108} avatar={settings.avatar} />
              <View style={{ position: 'absolute', right: -2, bottom: -2, width: 36, height: 36, borderRadius: 18, backgroundColor: c.brand, borderWidth: 3, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="camera" size={17} color="#FFFFFF" />
              </View>
            </Pressable>
            <Txt v="h2" style={{ marginTop: 12 }}>{settings.name || 'Add your name'}</Txt>
            {signed ? <Txt v="small" color="dim">{account.user.email}</Txt> : null}
          </View>
        </FadeIn>

        {msg.text ? <Notice tone={msg.tone} icon={msg.tone === 'good' ? 'checkCircle' : 'info'} text={msg.text} style={{ marginTop: 0, marginBottom: 12 }} /> : null}

        <Card>
          <Field label="Name" icon="user" value={name} onChangeText={setNameText} placeholder="What should I call you?" style={{ marginBottom: changed ? 12 : 0 }} />
          {changed ? <Btn label="Save name" icon="check" small onPress={saveName} disabled={busy || !name.trim()} /> : null}
        </Card>

        {signed ? (
          <>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="cloud" size={20} color="brand2" style={{ marginRight: 10 }} />
                  <Txt v="title">Cloud sync</Txt>
                </View>
                <Pill label={account.syncing ? 'Syncing' : account.error ? 'Failed' : account.last ? 'Up to date' : 'Not synced'} tone={account.error ? 'bad' : account.last ? 'good' : 'faint'} icon={account.error ? 'info' : 'checkCircle'} />
              </View>
              <Txt v="small" color="dim" style={{ marginTop: 8, marginBottom: 12 }}>Last synced {agoText(account.last)}. Hours, settings and your picture follow you to any phone you sign in on.</Txt>
              {account.error ? <Notice tone="bad" text={account.error} style={{ marginTop: 0, marginBottom: 12 }} /> : null}
              <Btn label={account.syncing ? 'Syncing...' : 'Sync now'} icon="refresh" kind="soft" small onPress={() => run(() => syncNow(), 'Synced.')} disabled={busy || account.syncing} />
            </Card>

            <Card pad={4}>
              <View style={{ paddingHorizontal: 12 }}>
                <Row icon="key" tone="brand" title="Change password" onPress={() => setSheet('password')} right={<Icon name="chevronR" size={18} color="faint" />} />
                <Row icon="logout" tone="warn" title="Sign out" sub={settings.name ? `Signed in as ${settings.name}` : account.user.email} onPress={askSignOut} right={<Icon name="chevronR" size={18} color="faint" />} />
                <Row icon="trash" tone="bad" title="Delete my cloud data" sub="Profile, picture and backed up hours" onPress={askDelete} last right={<Icon name="chevronR" size={18} color="faint" />} />
              </View>
            </Card>
          </>
        ) : (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Icon name="cloud" size={20} color="brand2" style={{ marginRight: 10 }} />
              <Txt v="title">Not signed in</Txt>
            </View>
            <Txt v="small" color="dim" style={{ marginBottom: 12 }}>Everything is saved on this phone. Sign in to back it up and open it on another phone.</Txt>
            <Btn label="Sign in or create account" icon="login" onPress={onAuth} />
          </Card>
        )}
      </Screen>

      {sheet === 'avatar' ? <AvatarSheet settings={settings} onClose={() => setSheet(null)} onMsg={setMsg} /> : null}
      {sheet === 'password' ? <PasswordSheet onClose={() => setSheet(null)} onMsg={setMsg} /> : null}
    </View>
  );
}

// the card at the top of Settings
export function AccountCard({ account, settings, onProfile, onAuth }) {
  const signed = !!account.user;
  return (
    <Card onPress={onProfile}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={settings.name} size={56} avatar={settings.avatar} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Txt v="h2">{settings.name || (signed ? 'Your profile' : 'Guest')}</Txt>
          <Txt v="small" color="dim" numberOfLines={1}>{signed ? account.user.email : 'Everything is on this phone only'}</Txt>
        </View>
        <Icon name="pencil" size={18} color="faint" />
      </View>
      {signed ? (
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <Pill label={account.syncing ? 'Syncing...' : account.error ? 'Sync failed' : `Synced ${agoText(account.last)}`} tone={account.error ? 'bad' : 'good'} icon={account.error ? 'info' : 'cloud'} />
        </View>
      ) : (
        <Btn label="Sign in or create account" icon="login" small onPress={onAuth} style={{ marginTop: 14 }} />
      )}
    </Card>
  );
}
