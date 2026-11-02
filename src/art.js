// the illustrations on the intro, lock and empty screens. drawn with gradients, rings and a few floating chips
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { Icon } from './icons';
import { Txt, tint, useTheme } from './theme';

// x and y are fractions of the artwork size
const KINDS = {
  plan: {
    icon: 'sparkles',
    chips: [
      { icon: 'clock', text: '9h 30m today', tone: 'brand', x: 0.0, y: 0.14 },
      { icon: 'target', text: '198h goal', tone: 'good', x: 0.5, y: 0.04 },
      { icon: 'trendUp', text: 'On pace', tone: 'brand2', x: 0.34, y: 0.8 },
    ],
  },
  alarm: {
    icon: 'bellRing',
    chips: [
      { icon: 'login', text: 'Check in 08:55', tone: 'brand', x: 0.0, y: 0.12 },
      { icon: 'logout', text: 'Leave 18:25', tone: 'bad', x: 0.46, y: 0.06 },
      { icon: 'coffee', text: 'Breaks count', tone: 'warn', x: 0.28, y: 0.8 },
    ],
  },
  office: {
    icon: 'pin',
    chips: [
      { icon: 'radar', text: 'Office detected', tone: 'brand2', x: 0.0, y: 0.16 },
      { icon: 'check', text: 'Checked in', tone: 'good', x: 0.52, y: 0.06 },
      { icon: 'phone', text: 'Home widget', tone: 'brand', x: 0.3, y: 0.8 },
    ],
  },
  insight: {
    icon: 'bars',
    chips: [
      { icon: 'flame', text: 'Weekly review', tone: 'warn', x: 0.0, y: 0.14 },
      { icon: 'chat', text: 'Ask the coach', tone: 'brand', x: 0.5, y: 0.05 },
      { icon: 'gauge', text: 'What if', tone: 'good', x: 0.32, y: 0.8 },
    ],
  },
  ready: {
    icon: 'checkCircle',
    chips: [
      { icon: 'lock', text: 'Stays on phone', tone: 'good', x: 0.0, y: 0.14 },
      { icon: 'bell', text: 'Alarms ready', tone: 'brand', x: 0.5, y: 0.05 },
      { icon: 'bot', text: 'Groq planner', tone: 'brand2', x: 0.3, y: 0.8 },
    ],
  },
  lock: { icon: 'fingerprint', chips: [] },
};

function Floating({ delay, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1900, delay, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[style, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }] }]}>{children}</Animated.View>;
}

export function Hero({ kind = 'plan', size = 300 }) {
  const { c, shadow } = useTheme();
  const k = KINDS[kind];
  const id = `hero${kind}`;
  const tile = size * 0.36;
  const mid = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.grad[0]} stopOpacity="0.32" />
            <Stop offset="1" stopColor={c.grad[1]} stopOpacity="0.06" />
          </SvgGradient>
        </Defs>
        <Circle cx={mid} cy={mid} r={size * 0.46} fill={`url(#${id})`} />
        <Circle cx={mid} cy={mid} r={size * 0.36} stroke={tint(c.brand, 0.2)} strokeWidth={1.5} fill="none" />
        <Circle cx={mid} cy={mid} r={size * 0.44} stroke={tint(c.brand2, 0.18)} strokeWidth={1.5} strokeDasharray="3 9" fill="none" />
        <Circle cx={size * 0.2} cy={size * 0.62} r={4} fill={tint(c.brand2, 0.7)} />
        <Circle cx={size * 0.86} cy={size * 0.5} r={5} fill={tint(c.brand, 0.6)} />
        <Circle cx={size * 0.74} cy={size * 0.9} r={3} fill={tint(c.brand2, 0.6)} />
        <Circle cx={size * 0.12} cy={size * 0.3} r={3} fill={tint(c.brand, 0.5)} />
      </Svg>

      <LinearGradient
        colors={c.grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: tile, height: tile, borderRadius: tile * 0.3, alignItems: 'center', justifyContent: 'center', shadowColor: c.brand, shadowOpacity: 0.55, shadowRadius: 26, shadowOffset: { width: 0, height: 14 }, elevation: 14 }}
      >
        <Icon name={k.icon} size={tile * 0.5} color="#FFFFFF" stroke={1.8} />
      </LinearGradient>

      {k.chips.map((chip, i) => {
        const col = c[chip.tone];
        return (
          <Floating key={chip.text} delay={i * 450} style={{ position: 'absolute', left: chip.x * size, top: chip.y * size }}>
            <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border }, shadow, { shadowOpacity: 0.2, elevation: 6 }]}>
              <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: tint(col, 0.16), alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                <Icon name={chip.icon} size={14} color={col} />
              </View>
              <Txt v="small" w={700} style={{ fontSize: 12 }}>{chip.text}</Txt>
            </View>
          </Floating>
        );
      })}
    </View>
  );
}
