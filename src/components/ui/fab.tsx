import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenPadding, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { type IconName } from './icon';
import { neu } from './neu';

/** Floating primary action: the standard primary Button, pinned just above the tab bar. */
export function Fab({
  label,
  onPress,
  icon = 'add',
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <View pointerEvents="box-none" style={styles.fab}>
      <Button label={label} icon={icon} onPress={onPress} style={styles.button} />
    </View>
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
  fab: { position: 'absolute', right: ScreenPadding, bottom: Spacing.three },
  button: { paddingHorizontal: Spacing.four + Spacing.one },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
