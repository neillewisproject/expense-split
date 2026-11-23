import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { neu, type Depth } from './neu';

/** Raised neumorphic surface. The inner layer clips content without clipping the shadows. */
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
      <View style={[styles.inner, padded && styles.padded, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl },
  inner: { borderRadius: Radius.xl, overflow: 'hidden' },
  padded: { padding: Spacing.three + Spacing.one, gap: Spacing.two },
});
