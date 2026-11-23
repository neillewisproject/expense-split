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
    primary: { background: theme.accent, text: theme.onAccent },
    secondary: { background: theme.accentSoft, text: theme.accent },
    ghost: { background: 'transparent', text: theme.accent },
    danger: { background: theme.dangerSoft, text: theme.danger },
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
        variant === 'ghost' && styles.ghost,
        inactive && styles.disabled,
        pressed && styles.pressed,
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
  const active = selected || tone === 'tonal';
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
        { backgroundColor: selected ? theme.accent : active ? theme.accentSoft : theme.card },
        !active && { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <Icon
        name={icon}
        size={20}
        color={selected ? theme.onAccent : active ? theme.accent : theme.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  ghost: { minHeight: 44, paddingHorizontal: Spacing.two },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
