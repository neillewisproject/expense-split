import { Children, isValidElement, type PropsWithChildren } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Banner, Icon } from '@/components/ui';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { Field } from '@/features/expenses/components/personal-ui';
import { useTheme } from '@/hooks/use-theme';

export function GroupPage({
  children,
  virtualized = false,
}: PropsWithChildren<{ virtualized?: boolean }>) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {virtualized ? (
            <FlatList
              data={Children.toArray(children)}
              keyExtractor={(item, index) =>
                isValidElement(item) && item.key !== null ? String(item.key) : String(index)
              }
              renderItem={({ item }) => <View>{item}</View>}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.gap} />}
              contentContainerStyle={styles.page}
            />
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.page, styles.stack]}>
              {children}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export function GroupField({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <Field
      label={label}
      value={value}
      onChange={onChange}
      multiline={multiline}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
    />
  );
}

const DESTRUCTIVE = /^(delete|void|deactivate|remove|archive|leave|keep remote)\b/i;

/**
 * Tonal action button. When `selected` is provided it becomes a toggle (checkbox role) that is
 * filled while on, used for show/hide sections and single choices.
 */
export function GroupButton({
  label,
  onPress,
  disabled = false,
  selected,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  const theme = useTheme();
  const toggle = selected !== undefined;
  const danger = !toggle && DESTRUCTIVE.test(label);
  const background = selected ? theme.accent : danger ? theme.dangerSoft : theme.accentSoft;
  const color = selected ? theme.onAccent : danger ? theme.danger : theme.accent;
  return (
    <Pressable
      accessibilityRole={toggle ? 'checkbox' : 'button'}
      accessibilityState={{ disabled, ...(toggle ? { checked: selected } : {}) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {toggle ? <Icon name={selected ? 'checked' : 'unchecked'} size={18} color={color} /> : null}
      <ThemedText type="smallBold" style={[styles.label, { color }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function GroupError({ error }: { error: string | null }) {
  return error ? <Banner tone="danger" message={error} /> : null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gap: { height: Spacing.three },
  page: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  stack: { gap: Spacing.three },
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
  label: { flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
