import type { ViewStyle } from 'react-native';

import type { ThemeColors } from '@/constants/theme';

export type Depth = 'raised' | 'raisedSm' | 'inset' | 'insetSm' | 'glow' | 'flat';

/**
 * Neumorphic depth. Surfaces share the background colour and get their shape from paired
 * shadows: a dark one bottom-right and a light one top-left. `inset` looks pressed in.
 */
export function neu(theme: ThemeColors, depth: Depth): ViewStyle {
  const { shadowDark: dark, shadowLight: light } = theme;
  switch (depth) {
    case 'raised':
      return { boxShadow: `7px 7px 16px ${dark}, -7px -7px 16px ${light}` };
    case 'raisedSm':
      return { boxShadow: `4px 4px 9px ${dark}, -4px -4px 9px ${light}` };
    case 'inset':
      return { boxShadow: `inset 4px 4px 8px ${dark}, inset -4px -4px 8px ${light}` };
    case 'insetSm':
      return { boxShadow: `inset 2px 2px 5px ${dark}, inset -2px -2px 5px ${light}` };
    case 'glow':
      return { boxShadow: `0px 8px 18px ${theme.accentGlow}, -4px -4px 10px ${light}` };
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
