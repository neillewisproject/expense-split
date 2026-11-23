import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { IconButton } from './button';
import { Icon } from './icon';
import { inputWell, neu } from './neu';

/** Bottom sheet built on React Native's Modal; tapping the backdrop closes it. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          style={StyleSheet.absoluteFill}
          onPress={onClose}>
          <View style={styles.backdrop} />
        </Pressable>
        <SafeAreaView
          edges={['bottom']}
          style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View
            style={[styles.handle, { backgroundColor: theme.background }, neu(theme, 'insetSm')]}
          />
          <View style={styles.titleRow}>
            <ThemedText type="heading" accessibilityRole="header" style={styles.title}>
              {title}
            </ThemedText>
            <IconButton icon="close" accessibilityLabel={`Close ${title}`} onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  accessibilityLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.search, inputWell(theme)]}>
      <Icon name="search" size={18} color={theme.textSecondary} />
      <TextInput
        accessibilityLabel={accessibilityLabel ?? placeholder}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        returnKeyType="search"
        style={[styles.searchInput, { color: theme.text }]}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={() => onChange('')}>
          <Icon name="close" size={16} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(43, 22, 0, 0.35)' },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    maxHeight: '88%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 6,
    borderRadius: 3,
    marginTop: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: ScreenPadding,
  },
  title: { flex: 1 },
  // Padding lives inside the ScrollView so shadows of chips and buttons are not clipped.
  content: { gap: Spacing.three, padding: ScreenPadding, paddingTop: Spacing.three },
  footer: { padding: ScreenPadding, paddingTop: Spacing.two, gap: Spacing.two },
  search: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    flex: 1,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: Spacing.two },
});
