import type { Href } from 'expo-router';
import {
  TabList,
  TabSlot,
  TabTrigger,
  Tabs,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, neu, type IconName } from '@/components/ui';
import { MaxContentWidth, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

const TABS: { name: string; href: Href; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'Home', icon: 'home' },
  { name: 'activity', href: '/activity', label: 'Activity', icon: 'activity' },
  { name: 'groups', href: '/groups', label: 'Groups', icon: 'groups' },
  { name: 'insights', href: '/insights', label: 'Insights', icon: 'insights' },
  { name: 'more', href: '/more', label: 'More', icon: 'more' },
];

/**
 * Neumorphic bottom tabs built with Expo Router's headless tabs so the bar matches the rest of
 * the UI. The bar sits below the screens (not over them), so screens need no bottom inset.
 */
export default function AppTabs() {
  const theme = useTheme();
  return (
    <Tabs style={{ backgroundColor: theme.background }}>
      <TabSlot />
      <TabList asChild>
        <TabBar>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon}>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  children,
  isFocused,
  icon,
  ...props
}: TabTriggerSlotProps & { icon: IconName }) {
  const theme = useTheme();
  const color = isFocused ? theme.accent : theme.textSecondary;
  return (
    <Pressable
      {...(props as PressableProps)}
      accessibilityRole="tab"
      accessibilityState={{ selected: Boolean(isFocused) }}
      style={({ pressed }) => [
        styles.tab,
        (isFocused || pressed) && [{ backgroundColor: theme.card }, neu(theme, 'insetSm')],
      ]}>
      <Icon name={icon} size={22} color={color} />
      <ThemedText type="caption" numberOfLines={1} style={[styles.label, { color }]}>
        {children}
      </ThemedText>
      <View
        style={[styles.dot, { backgroundColor: isFocused ? theme.accentFill : 'transparent' }]}
      />
    </Pressable>
  );
}

function TabBar({ children, style, ...props }: TabListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useAndroidKeyboardOpen();
  return (
    <View
      {...props}
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingBottom: Math.max(insets.bottom, Spacing.three),
        },
        keyboardOpen && styles.hidden,
        style,
      ]}>
      <View style={[styles.bar, { backgroundColor: theme.card }, neu(theme, 'raised')]}>
        {children}
      </View>
    </View>
  );
}

/** Android keeps the bar above the keyboard; hide it while typing, like native tab bars do. */
function useAndroidKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.two,
  },
  hidden: { display: 'none' },
  bar: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.one + 2,
    borderRadius: Radius.xl,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    borderRadius: Radius.lg,
  },
  label: { fontWeight: 600 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
