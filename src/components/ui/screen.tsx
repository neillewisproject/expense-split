import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { IconButton } from './button';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  large = false,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  large?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? <IconButton icon="back" accessibilityLabel="Back" onPress={onBack} /> : null}
      <View style={styles.headerText}>
        <ThemedText type={large ? 'title' : 'subtitle'} accessibilityRole="header">
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right ? <View style={styles.headerActions}>{right}</View> : null}
    </View>
  );
}

/**
 * Page shell: themed background, safe areas, centred max width and keyboard avoidance.
 * Use `scroll={false}` when the page renders its own FlatList.
 */
export function Screen({
  children,
  header,
  footer,
  scroll = true,
  tabBar = false,
  contentStyle,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  tabBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const bottom = tabBar ? BottomTabInset + Spacing.three : Spacing.five;
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safe} edges={tabBar ? ['top'] : ['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {header ? <View style={styles.headerWrap}>{header}</View> : null}
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.content, { paddingBottom: bottom }, contentStyle]}>
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.root, styles.fixed, contentStyle]}>{children}</View>
          )}
          {footer}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  headerWrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', gap: Spacing.two },
  content: { gap: Spacing.three, padding: Spacing.three },
  fixed: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionTitle: { letterSpacing: 0.6, fontWeight: 600 },
});
