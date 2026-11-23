import type { ViewStyle } from 'react-native';

import type { ThemeColors } from '@/constants/theme';

export type Depth = 'raised' | 'raisedSm' | 'inset' | 'insetSm' | 'glow' | 'glowSm' | 'flat';

/**
 * Neumorphic depth. Surfaces share the background colour and get their shape from paired
 * shadows: a dark one bottom-right and a light one top-left. `inset` looks pressed in.
 * Shadows reach at most ~18px past an element, so keep ≥20px of unclipped space around raised
 * items (scroll views clip their content; put padding inside `contentContainerStyle`).
 */
export function neu(theme: ThemeColors, depth: Depth): ViewStyle {
  const { shadowDark: dark, shadowLight: light } = theme;
  switch (depth) {
    case 'raised':
      return { boxShadow: `6px 6px 12px ${dark}, -6px -6px 12px ${light}` };
    case 'raisedSm':
      return { boxShadow: `3px 3px 7px ${dark}, -3px -3px 7px ${light}` };
    case 'inset':
      return { boxShadow: `inset 4px 4px 8px ${dark}, inset -4px -4px 8px ${light}` };
    case 'insetSm':
      return { boxShadow: `inset 2px 2px 5px ${dark}, inset -2px -2px 5px ${light}` };
    case 'glow':
      return { boxShadow: `0px 6px 14px ${theme.accentGlow}, -3px -3px 8px ${light}` };
    case 'glowSm':
      return { boxShadow: `0px 3px 8px ${theme.accentGlow}` };
    default:
      return {};
  }
}

/** Carved-in text field. The transparent border keeps size stable when focus adds colour. */
export function inputWell(theme: ThemeColors, focused = false): ViewStyle {
  return {
    backgroundColor: theme.background,
    borderWidth: 1.5,
    borderColor: focused ? theme.accentFill : 'transparent',
    ...neu(theme, 'inset'),
  };
}
