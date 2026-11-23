import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Banner,
  Button,
  ChipGroup,
  Screen,
  ScreenHeader,
  type ButtonVariant,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Standard pushed page: back button, title and a scrollable column of content. */
export function PersonalPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Screen
      header={<ScreenHeader onBack={() => router.back()} title={title} subtitle={subtitle} />}>
      {children}
    </Screen>
  );
}

export function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'email-address' | 'number-pad';
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            color: theme.text,
            backgroundColor: theme.card,
            borderColor: focused ? theme.accent : theme.border,
          },
        ]}
      />
    </View>
  );
}

const DESTRUCTIVE = /^(delete|remove|void|erase|discard|archive|sign out|leave)\b/i;

/**
 * Page action button. Defaults to a calm tonal style; destructive wording (Delete, Remove,
 * Void…) is shown in red automatically. Pass `variant="primary"` for the page's main action.
 */
export function Action({
  label,
  onPress,
  disabled = false,
  variant,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      disabled={disabled}
      variant={variant ?? (DESTRUCTIVE.test(label) ? 'danger' : 'secondary')}
    />
  );
}

export function Choices({
  values,
  value,
  onChange,
}: {
  values: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return <ChipGroup options={values} value={value} onChange={onChange} />;
}

export function Failure({ message }: { message: string | null }) {
  return message ? <Banner tone="danger" message={message} /> : null;
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Operation failed. Please retry.';
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  label: { fontWeight: 600 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
