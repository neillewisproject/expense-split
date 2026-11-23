import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

/** Floating primary action, pinned above the tab bar on tab screens. */
export function Fab({
  label,
  onPress,
  icon = 'add',
  tabBar = true,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  tabBar?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: theme.accent,
          bottom: (tabBar ? BottomTabInset : 0) + Spacing.three,
          shadowColor: theme.accent,
        },
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={20} color={theme.onAccent} />
      <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const AVATAR_COLORS = ['#5B5BD6', '#0E9384', '#DD2590', '#E04F16', '#1570EF', '#7A5AF8'];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?';
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length],
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: '#FFFFFF', fontSize: size * 0.38 }}>
        {initials}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.three,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    elevation: 6,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  pressed: { opacity: 0.85 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
