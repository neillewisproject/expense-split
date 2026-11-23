import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { neu, type Depth } from './neu';

/**
 * Raised neumorphic surface. Unpadded cards clip their edge-to-edge rows to the rounded corners;
 * padded cards never clip, so glows from buttons inside them stay visible.
 */
export function Card({
  children,
  style,
  padded = true,
  depth = 'raised',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  depth?: Depth;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card }, neu(theme, depth)]}>
      <View style={[styles.inner, padded ? styles.padded : styles.clip, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl },
  inner: { borderRadius: Radius.xl },
  clip: { overflow: 'hidden' },
  padded: { padding: ScreenPadding, gap: Spacing.three },
});
