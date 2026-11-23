import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'subtitle'
    | 'heading'
    | 'small'
    | 'smallBold'
    | 'caption'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = type === 'linkPrimary' && !themeColor ? theme.accent : theme[themeColor ?? 'text'];

  return <Text style={[{ color }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 500,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 400,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
  },
  default: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 400,
  },
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 600,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
    letterSpacing: -0.3,
  },
  link: {
    lineHeight: 22,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 22,
    fontSize: 14,
    fontWeight: 600,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
