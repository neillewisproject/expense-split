import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radius, Spacing, ScreenPadding } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';
import { neu } from './neu';

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
          backgroundColor: theme.accentFill,
          bottom: (tabBar ? BottomTabInset : 0) + Spacing.three,
        },
        neu(theme, pressed ? 'insetSm' : 'glow'),
      ]}>
      <Icon name={icon} size={20} color={theme.onAccent} />
      <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const AVATAR_COLORS = ['#C2410C', '#B45309', '#0F766E', '#BE185D', '#9A3412', '#4D7C0F'];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const theme = useTheme();
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
          borderColor: theme.card,
        },
        neu(theme, 'raisedSm'),
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
    right: ScreenPadding,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
  },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
