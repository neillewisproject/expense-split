import { Children, isValidElement, type PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function GroupPage({
  children,
  virtualized = false,
}: PropsWithChildren<{ virtualized?: boolean }>) {
  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {virtualized ? (
            <FlatList
              data={Children.toArray(children)}
              keyExtractor={(item, index) =>
                isValidElement(item) && item.key !== null ? String(item.key) : String(index)
              }
              renderItem={({ item }) => <View>{item}</View>}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.page}
            />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
              {children}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
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
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        multiline={multiline}
        style={[styles.input, { color: theme.text, borderColor: theme.textSecondary }]}
      />
    </View>
  );
}

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
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'checkbox'}
      accessibilityState={{ disabled, ...(selected === undefined ? {} : { checked: selected }) }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        disabled && { opacity: 0.5 },
        selected && { backgroundColor: '#1b5fbf' },
      ]}>
      <ThemedText style={{ color: '#fff', fontWeight: '600' }}>{label}</ThemedText>
    </Pressable>
  );
}

export function GroupError({ error }: { error: string | null }) {
  return error ? (
    <ThemedText accessibilityRole="alert" style={{ color: '#b42318' }}>
      {error}
    </ThemedText>
  ) : null;
}

const styles = StyleSheet.create({
  page: {
    gap: Spacing.three,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    backgroundColor: '#3c87f7',
    borderRadius: Spacing.two,
    padding: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
