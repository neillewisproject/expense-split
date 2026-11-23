import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';
import { neu } from './neu';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const palette = {
    primary: { background: theme.accentFill, text: theme.onAccent },
    secondary: { background: theme.card, text: theme.accent },
    ghost: { background: 'transparent', text: theme.accent },
    danger: { background: theme.card, text: theme.danger },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, ...(loading ? { busy: true } : {}) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background },
        variant === 'ghost'
          ? styles.ghost
          : neu(
              theme,
              pressed ? 'insetSm' : inactive ? 'flat' : variant === 'primary' ? 'glow' : 'raisedSm',
            ),
        inactive && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : icon ? (
        <Icon name={icon} size={18} color={palette.text} />
      ) : null}
      <ThemedText type="smallBold" style={{ color: palette.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  tone = 'plain',
  disabled = false,
  selected = false,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  tone?: 'plain' | 'tonal';
  disabled?: boolean;
  selected?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: selected ? theme.accentFill : theme.card },
        neu(theme, pressed ? 'insetSm' : selected ? 'glow' : 'raisedSm'),
        disabled && styles.disabled,
      ]}>
      <Icon
        name={icon}
        size={20}
        color={selected ? theme.onAccent : tone === 'tonal' ? theme.accent : theme.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  ghost: { minHeight: 44, paddingHorizontal: Spacing.two },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
});
