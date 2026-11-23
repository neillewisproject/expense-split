import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';
import { neu } from './neu';

/** Raised pill; the selected chip is filled orange so the state never relies on depth alone. */
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
  const color = selected ? theme.onAccent : theme.text;
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
        { backgroundColor: selected ? theme.accentFill : theme.card },
        neu(theme, pressed ? 'insetSm' : selected ? 'glow' : 'raisedSm'),
        disabled && styles.disabled,
      ]}>
      {icon ? <Icon name={icon} size={16} color={selected ? color : theme.accent} /> : null}
      <ThemedText type="smallBold" style={{ color }}>
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
      style={styles.scroller}
      contentContainerStyle={[styles.row, styles.scrollContent]}
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
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  row: { flexDirection: 'row', gap: Spacing.two + Spacing.one },
  wrap: { flexWrap: 'wrap', paddingVertical: Spacing.one },
  // Room for chip shadows, which a horizontal ScrollView would otherwise clip.
  scroller: { marginHorizontal: -Spacing.two },
  scrollContent: { padding: Spacing.two },
  disabled: { opacity: 0.5 },
});
