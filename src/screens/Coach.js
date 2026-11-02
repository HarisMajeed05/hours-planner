import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { askCoach } from '../groq';
import { coachContext } from '../logic';
import { Icon, Screen, Txt, tint, useKeyboard, useTheme } from '../ui';

const REVIEW = 'Give me my weekly review: three short observations about my last days and one concrete suggestion for next week.';
const QUICK = [
  { icon: 'flame', tone: 'warn', title: 'Weekly review', text: 'Three observations and one suggestion', q: REVIEW },
  { icon: 'gauge', tone: 'good', title: 'Am I on track?', text: 'An honest read of this month', q: 'Am I on track for this month? Be honest.' },
  { icon: 'trendDown', tone: 'bad', title: 'Where am I losing hours?', text: 'Compare my days with the plan', q: 'Where am I losing hours compared to the plan?' },
];

function Typing() {
  const { c } = useTheme();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = dots.map((d, i) => Animated.loop(Animated.sequence([Animated.delay(i * 160), Animated.timing(d, { toValue: 1, duration: 360, useNativeDriver: true }), Animated.timing(d, { toValue: 0.3, duration: 360, useNativeDriver: true })])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, alignSelf: 'flex-start', borderWidth: 1, borderColor: c.border }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, marginHorizontal: 3, backgroundColor: c.brand, opacity: d }} />
      ))}
    </View>
  );
}

export default function Coach({ days, settings, stats, now, chat, setChat }) {
  const { c } = useTheme();
  const kb = useKeyboard();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const scroll = useRef(null);

  async function send(text) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    const history = [...chat, { role: 'user', content: t }];
    setChat(history);
    setInput('');
    setBusy(true);
    setErr('');
    try {
      const reply = await askCoach({ model: settings.model, history, context: coachContext(days, settings, now, stats) });
      setChat([...history, { role: 'assistant', content: reply.trim() || 'No answer came back, try again.' }]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 10 }}>
        <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Icon name="sparkles" size={23} color="#FFFFFF" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Txt v="h1" style={{ fontSize: 22 }}>Coach</Txt>
          <Txt v="small" color="dim">Works only from your real numbers</Txt>
        </View>
        {chat.length ? (
          <Pressable onPress={() => setChat([])} hitSlop={10} style={{ padding: 8 }}>
            <Icon name="trash" size={20} color="faint" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: 18, paddingTop: 8 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {chat.length === 0 ? (
          <View>
            <Txt v="body" color="dim" style={{ marginBottom: 14 }}>Ask about your month, or start with one of these. For exact what-ifs use the Insights tab, this coach talks but does not do the math.</Txt>
            {QUICK.map((q) => {
              const col = c[q.tone];
              return (
                <Pressable key={q.title} onPress={() => send(q.q)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border }}>
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: tint(col, 0.14), alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Icon name={q.icon} size={20} color={col} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="title">{q.title}</Txt>
                    <Txt v="small" color="dim">{q.text}</Txt>
                  </View>
                  <Icon name="chevronR" size={18} color="faint" />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {chat.map((m, i) =>
          m.role === 'user' ? (
            <LinearGradient key={i} colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ alignSelf: 'flex-end', borderRadius: 20, borderBottomRightRadius: 6, padding: 13, marginBottom: 10, maxWidth: '86%' }}>
              <Txt v="body" color="#FFFFFF">{m.content}</Txt>
            </LinearGradient>
          ) : (
            <View key={i} style={{ alignSelf: 'flex-start', backgroundColor: c.surface, borderRadius: 20, borderBottomLeftRadius: 6, padding: 13, marginBottom: 10, maxWidth: '90%', borderWidth: 1, borderColor: c.border }}>
              <Txt v="body">{m.content}</Txt>
            </View>
          )
        )}
        {busy ? <Typing /> : null}
        {err ? <Txt v="small" color="warn" style={{ marginTop: 8 }}>{err}</Txt> : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingTop: 8, paddingBottom: kb ? 12 : 108 }}>
        <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 24, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 16, marginRight: 10 }}>
          <TextInput value={input} onChangeText={setInput} placeholder="Ask something" placeholderTextColor={c.faint} multiline style={{ color: c.text, fontFamily: 'Inter_500Medium', fontSize: 15, maxHeight: 110, paddingVertical: 13 }} />
        </View>
        <Pressable onPress={() => send()} disabled={busy || !input.trim()} style={{ opacity: busy || !input.trim() ? 0.45 : 1 }}>
          <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" size={21} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </Screen>
  );
}
