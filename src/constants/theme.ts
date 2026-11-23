/**
 * Design tokens for the app: colours for light and dark mode, spacing, corner radii and fonts.
 * Build screens from `@/components/ui` so they stay consistent with these tokens.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#101828',
    textSecondary: '#667085',
    background: '#F5F6FA',
    card: '#FFFFFF',
    backgroundElement: '#EEF0F5',
    backgroundSelected: '#E2E5EE',
    border: '#E4E7EC',
    accent: '#5B5BD6',
    accentSoft: '#EEEEFC',
    onAccent: '#FFFFFF',
    success: '#079455',
    successSoft: '#E6F6EE',
    danger: '#D92D20',
    dangerSoft: '#FDECEA',
    warning: '#B54708',
    warningSoft: '#FEF3E2',
  },
  dark: {
    text: '#F2F4F7',
    textSecondary: '#98A2B3',
    background: '#0B0D12',
    card: '#161922',
    backgroundElement: '#1F2330',
    backgroundSelected: '#2B3040',
    border: '#262B38',
    accent: '#8484F5',
    accentSoft: '#25254A',
    onAccent: '#FFFFFF',
    success: '#47CD89',
    successSoft: '#10291C',
    danger: '#F97066',
    dangerSoft: '#3A1613',
    warning: '#FDB022',
    warningSoft: '#33250B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type ThemeColors = (typeof Colors)[keyof typeof Colors];

/** Gradient used by the hero summary card; readable with white text in both colour schemes. */
export const HeroGradient = ['#5B5BD6', '#8B4FD8'] as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
