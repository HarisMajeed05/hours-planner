import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, KeyboardAvoidingView, View } from 'react-native';
import { useFonts } from 'expo-font';
// only the five weights I use, importing the package root would bundle every Inter font
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { syncGeofence, unlockWithBiometrics } from './src/device';
import { checkInDay, checkOutDay, dateKey, monthStats } from './src/logic';
import { ensurePermission, initNotifications, syncNotifications } from './src/notify';
import { DEFAULTS, read, subscribe, updateDay, updateSettings } from './src/store';
import { DayEditor, LockScreen, TabBar, ThemeProvider, useTheme } from './src/ui';
import { refreshWidget } from './src/widget';
import Coach from './src/screens/Coach';
import DataTools from './src/screens/Data';
import Insights from './src/screens/Insights';
import Month from './src/screens/Month';
import Onboarding from './src/screens/Onboarding';
import Settings from './src/screens/Settings';
import Today from './src/screens/Today';

initNotifications();
SplashScreen.preventAutoHideAsync().catch(() => {}); // the native splash stays until fonts and data are ready

const TABS = [
  { id: 'today', label: 'Today', icon: 'clock' },
  { id: 'month', label: 'Month', icon: 'calendarDays' },
  { id: 'insights', label: 'Insights', icon: 'bars' },
  { id: 'coach', label: 'Coach', icon: 'sparkles' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];
const LOCK_AFTER = 60000; // lock again after a minute away

function Shell({ state, ready }) {
  const { c, dark } = useTheme();
  const [now, setNow] = useState(new Date());
  const [wake, setWake] = useState(0); // bumps every time I come back to the app
  const [tab, setTab] = useState('today');
  const [editKey, setEditKey] = useState(null);
  const [showData, setShowData] = useState(false);
  const [chat, setChat] = useState([]);
  const [locked, setLocked] = useState(true);
  const lockOn = useRef(false);
  const leftAt = useRef(null);
  const handled = useRef(null);

  lockOn.current = !!state.settings.lock;
  const showLock = ready && locked && state.settings.lock;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);

  // keep the clock fresh, and re-plan (and re-lock if I was away) when I come back
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 20000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') leftAt.current = Date.now();
      if (st !== 'active') return;
      setNow(new Date());
      setWake((w) => w + 1);
      if (lockOn.current && leftAt.current && Date.now() - leftAt.current > LOCK_AFTER) setLocked(true);
      leftAt.current = null;
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, []);

  // back closes the data screen, then returns to Today, then leaves the app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showData) {
        setShowData(false);
        return true;
      }
      if (tab !== 'today') {
        setTab('today');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [showData, tab]);

  const unlock = useCallback(async () => {
    if (await unlockWithBiometrics()) setLocked(false);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setLocked(!!state.settings.lock);
    if (state.settings.onboarded) ensurePermission().catch(() => {});
    refreshWidget();
    SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    if (showLock) unlock();
  }, [showLock]);

  // rebuild the alarms from fresh numbers whenever my data changes or I reopen the app
  useEffect(() => {
    if (!ready) return;
    const n = new Date();
    syncNotifications({ settings: state.settings, stats: monthStats(state.days, state.settings, n), now: n });
  }, [ready, state, wake]);

  // the office fence only restarts when the spot, radius or mode changed
  const { geo, office, radius } = state.settings;
  useEffect(() => {
    if (ready) syncGeofence(state.settings).catch(() => {});
  }, [ready, geo, office, radius]);

  const stats = useMemo(() => monthStats(state.days, state.settings, now), [state, now]);

  const today = () => dateKey(new Date());
  const checkIn = useCallback(() => updateDay(today(), (d) => checkInDay(d, Date.now())), []);
  const checkOut = useCallback(() => updateDay(today(), (d) => checkOutDay(d, Date.now())), []);
  const finish = useCallback(() => updateDay(today(), (d) => ({ ...d, done: true })), []);
  const patchDay = useCallback((key, patch) => updateDay(key, (d) => ({ ...d, ...patch })), []);

  // the buttons on the alarm notifications open the app and arrive here
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!ready || !last) return;
    const id = `${last.notification.request.identifier}|${last.actionIdentifier}`;
    if (handled.current === id) return;
    handled.current = id;
    if (last.actionIdentifier === 'do-checkin') checkIn();
    if (last.actionIdentifier === 'do-checkout') checkOut();
    Notifications.clearLastNotificationResponse();
  }, [last, ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (showLock) return <LockScreen onUnlock={unlock} />;
  if (!state.settings.onboarded) return <Onboarding settings={state.settings} onDone={updateSettings} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {tab === 'today' && (
            <Today days={state.days} settings={state.settings} stats={stats} onCheckIn={checkIn} onCheckOut={checkOut} onFinish={finish} onPatch={patchDay} onEdit={setEditKey} />
          )}
          {tab === 'month' && <Month now={now} stats={stats} settings={state.settings} onEdit={setEditKey} />}
          {tab === 'insights' && <Insights days={state.days} settings={state.settings} stats={stats} now={now} />}
          {tab === 'coach' && <Coach days={state.days} settings={state.settings} stats={stats} now={now} chat={chat} setChat={setChat} />}
          {tab === 'settings' && <Settings settings={state.settings} onPatch={updateSettings} onData={() => setShowData(true)} />}
          {showData && <DataTools days={state.days} settings={state.settings} onClose={() => setShowData(false)} />}
        </View>
        {!showData && <TabBar tabs={TABS} value={tab} onChange={setTab} />}
      </KeyboardAvoidingView>

      <DayEditor
        dayKey={editKey}
        day={editKey ? state.days[editKey] : null}
        onClose={() => setEditKey(null)}
        onSave={(key, v) => {
          patchDay(key, v);
          setEditKey(null);
        }}
      />
    </View>
  );
}

export default function App() {
  const [state, setState] = useState({ settings: DEFAULTS, days: {} });
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });

  useEffect(() => {
    read().then((s) => {
      setState(s);
      setReady(true);
    });
    return subscribe(setState);
  }, []);

  // nothing is drawn until the font is in, the native splash covers the wait
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider mode={state.settings.theme}>
      <SafeAreaProvider>
        <Shell state={state} ready={ready} />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
