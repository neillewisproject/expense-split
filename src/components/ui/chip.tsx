import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

export function Chip({
  label,
  selected,
  onPress,
  icon,
  role = 'radio',
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  role?: 'radio' | 'checkbox' | 'button';
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={
        role === 'button' ? { disabled } : { checked: selected, ...(disabled ? { disabled } : {}) }
      }
      disabled={disabled || undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.card,
          borderColor: selected ? theme.accent : theme.border,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {icon ? <Icon name={icon} size={16} color={selected ? theme.onAccent : theme.text} /> : null}
      <ThemedText type="smallBold" style={{ color: selected ? theme.onAccent : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Single-choice chips that wrap onto multiple lines, or scroll horizontally when `scroll` is set. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  scroll = false,
}: {
  options: readonly { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const chips = options.map((option) => (
    <Chip
      key={option.value}
      label={option.label}
      icon={option.icon}
      selected={option.value === value}
      onPress={() => onChange(option.value)}
    />
  ));
  return scroll ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="radiogroup">
      {chips}
    </ScrollView>
  ) : (
    <View style={[styles.row, styles.wrap]} accessibilityRole="radiogroup">
      {chips}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  wrap: { flexWrap: 'wrap' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
