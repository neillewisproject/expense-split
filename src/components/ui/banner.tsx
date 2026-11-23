import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const ICON: Record<Tone, IconName> = {
  info: 'info',
  warning: 'warning',
  danger: 'error',
  success: 'checked',
};

export function Banner({
  tone = 'info',
  message,
  actionLabel,
  onAction,
  children,
}: {
  tone?: Tone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const palette = {
    info: { color: theme.accent, background: theme.accentSoft },
    warning: { color: theme.warning, background: theme.warningSoft },
    danger: { color: theme.danger, background: theme.dangerSoft },
    success: { color: theme.success, background: theme.successSoft },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette.background }]}>
      <Icon name={ICON[tone]} size={18} color={palette.color} />
      <View style={styles.body}>
        <ThemedText
          type="small"
          accessibilityRole={tone === 'danger' ? 'alert' : undefined}
          style={{ color: theme.text }}>
          {message}
        </ThemedText>
        {children}
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: palette.color }}>
              {actionLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  body: { flex: 1, gap: Spacing.one },
});
