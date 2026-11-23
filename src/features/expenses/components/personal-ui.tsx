import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Banner,
  Button,
  Card,
  ChipGroup,
  inputWell,
  neu,
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
          { color: theme.text },
          inputWell(theme, focused),
        ]}
      />
    </View>
  );
}

const DESTRUCTIVE = /^(delete|remove|void|erase|discard|archive|sign out|leave)\b/i;

function actionVariant(label: string, variant?: ButtonVariant): ButtonVariant {
  return variant ?? (DESTRUCTIVE.test(label) ? 'danger' : 'secondary');
}

export type ItemAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  accessibilityLabel?: string;
};

/**
 * A list item on personal pages: raised card with a title, detail lines, an optional progress
 * bar (0–1) and compact action buttons.
 */
export function ItemCard({
  title,
  details = [],
  progress,
  actions = [],
}: {
  title: string;
  details?: (string | false | null | undefined)[];
  progress?: { value: number; warning?: boolean };
  actions?: ItemAction[];
}) {
  const theme = useTheme();
  const fill = progress ? Math.min(1, Math.max(0, progress.value)) : 0;
  return (
    <Card>
      <ThemedText type="smallBold">{title}</ThemedText>
      {details.filter(Boolean).map((line, index) => (
        <ThemedText key={index} type="caption" themeColor="textSecondary">
          {line}
        </ThemedText>
      ))}
      {progress ? (
        <View style={[styles.track, { backgroundColor: theme.background }, neu(theme, 'insetSm')]}>
          <View
            style={[
              styles.bar,
              {
                width: `${Math.max(4, Math.round(fill * 100))}%`,
                backgroundColor: progress.warning ? theme.danger : theme.accentFill,
              },
            ]}
          />
        </View>
      ) : null}
      {actions.length ? (
        <View style={styles.itemActions}>
          {actions.map((action) => (
            <Button
              key={action.label}
              label={action.label}
              accessibilityLabel={action.accessibilityLabel}
              onPress={action.onPress}
              disabled={action.disabled}
              variant={actionVariant(action.label, action.variant)}
              style={styles.itemAction}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

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
      variant={actionVariant(label, variant)}
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
    minHeight: 50,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  track: { height: 12, borderRadius: Radius.pill, padding: 2, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: Radius.pill },
  itemActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  itemAction: { flexGrow: 1, minHeight: 42, paddingHorizontal: Spacing.three },
});
