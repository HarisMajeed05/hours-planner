// design tokens, the Inter font mapping, the theme provider and the text component
import React, { createContext, useContext, useMemo } from 'react';
import { Text, useColorScheme } from 'react-native';

// React Native can't map font weights onto a custom font, so every weight is its own family
export const FONT = { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold', 800: 'Inter_800ExtraBold' };

const dark = {
  bg: '#070B16', bg2: '#0C1330', surface: '#111A36', surfaceHi: '#18234A', border: '#222F5C',
  text: '#F4F7FF', dim: '#A3B0D0', faint: '#6A779C',
  brand: '#8B7BFF', brand2: '#22D3EE', onBrand: '#FFFFFF',
  good: '#34D399', warn: '#FBBF24', bad: '#FB7185', info: '#60A5FA', scrim: '#000000B0',
  grad: ['#5B3DF5', '#14B8E6'],
};
const light = {
  bg: '#F2F4FB', bg2: '#E6EAF7', surface: '#FFFFFF', surfaceHi: '#F5F6FC', border: '#E1E6F4',
  text: '#0B1020', dim: '#55618A', faint: '#98A2C0',
  brand: '#5B3DF5', brand2: '#0891B2', onBrand: '#FFFFFF',
  good: '#059669', warn: '#B45309', bad: '#E11D48', info: '#2563EB', scrim: '#0B102099',
  grad: ['#5B3DF5', '#14B8E6'],
};

// hero gradients that follow the state of the day
export const HERO = {
  work: ['#5B3DF5', '#14B8E6'],
  done: ['#047857', '#34D399'],
  break: ['#B45309', '#FBBF24'],
  off: ['#334155', '#64748B'],
};

// "#RRGGBB" plus an alpha between 0 and 1
export const tint = (hex, a) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;

const ThemeCtx = createContext({ c: dark, dark: true, shadow: {} });
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ mode, children }) {
  const sys = useColorScheme();
  const isDark = mode === 'system' ? sys !== 'light' : mode === 'dark';
  const value = useMemo(
    () => ({
      c: isDark ? dark : light,
      dark: isDark,
      // cards float in light mode and sit flat in dark mode
      shadow: isDark ? {} : { shadowColor: '#1E2A5A', shadowOpacity: 0.09, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
    }),
    [isDark]
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

const V = {
  display: { s: 34, l: 40, w: 800 },
  h1: { s: 26, l: 32, w: 800 },
  h2: { s: 20, l: 26, w: 700 },
  title: { s: 16, l: 22, w: 600 },
  body: { s: 15, l: 22, w: 400 },
  small: { s: 13, l: 18, w: 500 },
  caption: { s: 11, l: 14, w: 700, up: true },
  num: { s: 44, l: 50, w: 800, tab: true },
  numSm: { s: 20, l: 26, w: 700, tab: true },
};

// color is a theme token (dim, faint, brand, good...) or any hex
export function Txt({ v = 'body', color, w, align, style, children, ...rest }) {
  const { c } = useTheme();
  const t = V[v];
  return (
    <Text
      maxFontSizeMultiplier={1.2}
      {...rest}
      style={[
        {
          fontFamily: FONT[w ?? t.w],
          fontSize: t.s,
          lineHeight: t.l,
          color: color ? (c[color] ?? color) : c.text,
          textAlign: align,
        },
        t.up ? { textTransform: 'uppercase', letterSpacing: 0.9 } : null,
        t.tab ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
