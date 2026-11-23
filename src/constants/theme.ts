/**
 * Design tokens for the app: colours for light and dark mode, spacing, corner radii and fonts.
 * Build screens from `@/components/ui` so they stay consistent with these tokens.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2E2620',
    textSecondary: '#6E6052',
    background: '#F0EAE2',
    card: '#F0EAE2',
    backgroundElement: '#E7DFD4',
    backgroundSelected: '#DDD3C6',
    border: '#E2D9CD',
    shadowDark: '#D3C7B7',
    shadowLight: '#FFFFFF',
    accent: '#A3480B',
    accentFill: '#FF8A1F',
    accentGlow: 'rgba(255, 138, 31, 0.38)',
    accentSoft: '#FBE2C6',
    onAccent: '#2B1600',
    success: '#2B7A3D',
    successSoft: '#DCEFD9',
    danger: '#B93229',
    dangerSoft: '#F8DDD7',
    warning: '#8F5300',
    warningSoft: '#FBE8C4',
  },
  dark: {
    text: '#F5EDE3',
    textSecondary: '#BFB1A2',
    background: '#2A2520',
    card: '#2A2520',
    backgroundElement: '#332D27',
    backgroundSelected: '#3D362F',
    border: '#3A332C',
    shadowDark: '#1A1613',
    shadowLight: '#3A332C',
    accent: '#FFB25C',
    accentFill: '#FF9A2E',
    accentGlow: 'rgba(255, 154, 46, 0.28)',
    accentSoft: '#4A3420',
    onAccent: '#2B1600',
    success: '#6CCB7E',
    successSoft: '#1F3322',
    danger: '#FF8A7A',
    dangerSoft: '#45221D',
    warning: '#FFC757',
    warningSoft: '#43341A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type ThemeColors = (typeof Colors)[keyof typeof Colors];

/** Sunrise gradient for the hero card and logo; pair it with `onAccent` (dark) text. */
export const HeroGradient = ['#FFD166', '#FFA53D', '#FF7F1F'] as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
/** Horizontal page padding; wide enough that neumorphic shadows are not cut off at the edges. */
export const ScreenPadding = 20;
