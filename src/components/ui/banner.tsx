import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';
import { neu } from './neu';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const ICON: Record<Tone, IconName> = {
  info: 'info',
  warning: 'warning',
  danger: 'error',
  success: 'checked',
};

/** Raised notice with a coloured edge and icon; the tone colour carries meaning, not the depth. */
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
    <View style={[styles.shell, { backgroundColor: theme.card }, neu(theme, 'raisedSm')]}>
      <View style={styles.banner}>
        <View style={[styles.edge, { backgroundColor: palette.color }]} />
        <View style={[styles.icon, { backgroundColor: palette.background }]}>
          <Icon name={ICON[tone]} size={18} color={palette.color} />
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderRadius: Radius.lg },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
    paddingLeft: Spacing.three + Spacing.one,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: Spacing.one, paddingTop: Spacing.one },
});
