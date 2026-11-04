// the sounds I can pick, and how each kind of notification turns my choices into an Android channel.
// Android freezes a channel's sound once it exists, so every combination of sound, vibration and priority gets its own channel id
import * as N from 'expo-notifications';
import { DEFAULT_SOUNDS } from './store';

export { DEFAULT_SOUNDS };

// file is the name inside res/raw (set up by the expo-notifications plugin in app.json), src is the same file for the in-app preview
export const SOUNDS = [
  { id: 'classic', label: 'Classic beeps', sub: 'Loud, 10 seconds', file: 'classic.wav', src: require('../assets/sounds/classic.wav') },
  { id: 'pulse', label: 'Digital pulse', sub: 'Sharp, 4 seconds', file: 'pulse.wav', src: require('../assets/sounds/pulse.wav') },
  { id: 'rise', label: 'Rising tones', sub: 'Bright, 4 seconds', file: 'rise.wav', src: require('../assets/sounds/rise.wav') },
  { id: 'chime', label: 'Chime', sub: 'Gentle bells', file: 'chime.wav', src: require('../assets/sounds/chime.wav') },
  { id: 'soft', label: 'Soft ping', sub: 'Quiet, short', file: 'soft.wav', src: require('../assets/sounds/soft.wav') },
  { id: 'pop', label: 'Pop', sub: 'Very short', file: 'pop.wav', src: require('../assets/sounds/pop.wav') },
  { id: 'system', label: 'Phone default', sub: 'Your notification sound' },
  { id: 'silent', label: 'Silent', sub: 'No sound' },
];

export const KINDS = {
  alarm: { label: 'Alarms', sub: 'Check in and check out alarms', icon: 'alarm', tone: 'brand' },
  reminder: { label: 'Reminders', sub: 'Hours done, 15 minutes to go, workload nudge', icon: 'bell', tone: 'warn' },
  auto: { label: 'Automatic check ins', sub: 'When the app checks you in or out for you', icon: 'radar', tone: 'brand2' },
};

// saved settings merged over the defaults, so an older save without a field still works
export const soundPrefs = (settings) => {
  const out = {};
  for (const k of Object.keys(DEFAULT_SOUNDS)) out[k] = { ...DEFAULT_SOUNDS[k], ...(settings?.sounds?.[k] ?? {}) };
  return out;
};

// the channel for one kind of notification: its id and the definition handed to Android
export function channelFor(kind, settings) {
  const p = soundPrefs(settings)[kind];
  const importance = kind === 'alarm' ? 'max' : p.priority; // alarms are always top priority
  const id = `${kind}-${p.sound}-${p.vibrate ? 'v' : 'q'}-${importance}`;
  const snd = SOUNDS.find((s) => s.id === p.sound) ?? SOUNDS[0];
  return {
    id,
    def: {
      name: KINDS[kind].label,
      description: KINDS[kind].sub,
      importance: { max: N.AndroidImportance.MAX, high: N.AndroidImportance.HIGH, default: N.AndroidImportance.DEFAULT }[importance],
      sound: snd.id === 'system' ? 'default' : snd.id === 'silent' ? null : snd.file,
      enableVibrate: p.vibrate,
      vibrationPattern: p.vibrate ? [0, 500, 250, 500] : null,
      audioAttributes:
        kind === 'alarm'
          ? { usage: N.AndroidAudioUsage.ALARM, contentType: N.AndroidAudioContentType.SONIFICATION }
          : { usage: N.AndroidAudioUsage.NOTIFICATION, contentType: N.AndroidAudioContentType.SONIFICATION },
      lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
    },
  };
}
