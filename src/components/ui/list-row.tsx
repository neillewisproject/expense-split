import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';
import { neu } from './neu';

/** Icon sitting in a carved-in neumorphic well. */
export function IconBadge({
  icon,
  color,
  size = 40,
  raised = false,
}: {
  icon: IconName;
  color?: string;
  size?: number;
  raised?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size * 0.36,
          backgroundColor: theme.card,
        },
        neu(theme, raised ? 'raisedSm' : 'insetSm'),
      ]}>
      <Icon name={icon} size={size * 0.48} color={color ?? theme.accent} />
    </View>
  );
}

/** A tappable settings/navigation style row: leading icon, title, subtitle and trailing content. */
export function ListRow({
  title,
  subtitle,
  icon,
  iconColor,
  leading,
  trailing,
  onPress,
  chevron = Boolean(onPress),
  accessibilityLabel,
  destructive = false,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  accessibilityLabel?: string;
  destructive?: boolean;
}) {
  const theme = useTheme();
  const content = (
    <>
      {leading ?? (icon ? <IconBadge icon={icon} color={iconColor} /> : null)}
      <View style={styles.text}>
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          style={destructive ? { color: theme.danger } : undefined}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {typeof trailing === 'string' ? (
        <ThemedText type="smallBold" style={styles.trailing}>
          {trailing}
        </ThemedText>
      ) : (
        trailing
      )}
      {chevron ? <Icon name="chevronRight" size={16} color={theme.textSecondary} /> : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

export function Divider({ inset = 72 }: { inset?: number }) {
  const theme = useTheme();
  return <View style={[styles.divider, { marginLeft: inset, backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Radius.md,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  trailing: { flexShrink: 0, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, marginRight: Spacing.three },
});
