import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, Chip, inputWell, neu } from '@/components/ui';
import { Radius, ScreenPadding, Spacing } from '@/constants/theme';
import {
  EXPENSE_CATEGORIES,
  expenseFormSchema,
  type ExpenseFormValues,
  type ExpenseFormRawValues,
  categoryLabel,
} from '@/features/expenses/domain/expense';
import { useTheme } from '@/hooks/use-theme';
import type { Account } from '@/features/accounts/data/schema';
import type { StoredExpense } from '../data/schema';
import { ReceiptPicker } from '@/features/receipts/components/receipt-picker';
import {
  suggestedCategoryRule,
  type CategoryRule,
} from '@/features/settings/domain/category-rules';
import { categoryStyle } from './category-style';

type ExpenseFormProps = {
  initialValues: ExpenseFormValues;
  initialReceiptUris?: string[];
  submitLabel: string;
  saveError: string | null;
  onSave: (values: ExpenseFormValues, receiptUris: string[]) => Promise<void>;
  accounts?: Account[];
  customCategories?: string[];
  originalExpenses?: StoredExpense[];
  categoryRules?: CategoryRule[];
};

const ENTRY_TYPES = ['expense', 'income', 'refund', 'transfer'] as const;

export function ExpenseForm({
  initialValues,
  initialReceiptUris = [],
  submitLabel,
  saveError,
  onSave,
  accounts = [],
  customCategories = [],
  originalExpenses = [],
  categoryRules = [],
}: ExpenseFormProps) {
  const theme = useTheme();
  const [receiptUris, setReceiptUris] = useState(initialReceiptUris);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<ExpenseFormRawValues, unknown, ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: initialValues,
  });
  const entryType = useWatch({ control, name: 'entryType' });
  const description = useWatch({ control, name: 'description' });
  const selectedCategory = useWatch({ control, name: 'category' });
  const suggestion = suggestedCategoryRule(
    categoryRules,
    description ?? '',
    entryType ?? 'expense',
  );

  const inputStyle = [styles.input, { color: theme.text }, inputWell(theme)];
  const errorText = (message?: string) =>
    message ? (
      <ThemedText type="caption" accessibilityRole="alert" style={{ color: theme.danger }}>
        {message}
      </ThemedText>
    ) : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoidingView}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Controller
          control={control}
          name="entryType"
          render={({ field }) => (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Transaction type"
              style={[styles.segments, inputWell(theme)]}>
              {ENTRY_TYPES.map((type) => {
                const checked = (field.value ?? 'expense') === type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="radio"
                    accessibilityState={{ checked }}
                    onPress={() => {
                      field.onChange(type);
                      setValue('toAccountId', '');
                      setValue('refundOfId', '');
                    }}
                    style={[
                      styles.segment,
                      checked && [{ backgroundColor: theme.accentFill }, neu(theme, 'glowSm')],
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={{ color: checked ? theme.onAccent : theme.textSecondary }}>
                      {type[0]!.toUpperCase() + type.slice(1)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
        />

        <Card>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
            Amount
          </ThemedText>
          <View style={styles.amountRow}>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <TextInput
                  accessibilityLabel="Currency"
                  autoCapitalize="characters"
                  maxLength={3}
                  value={field.value ?? 'INR'}
                  onChangeText={(value) => field.onChange(value.toUpperCase())}
                  style={[
                    styles.currency,
                    { color: theme.accent, backgroundColor: theme.card },
                    neu(theme, 'raisedSm'),
                  ]}
                />
              )}
            />
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <TextInput
                  accessibilityLabel="Amount"
                  keyboardType="decimal-pad"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.amount, { color: theme.text }]}
                  value={field.value}
                />
              )}
            />
          </View>
          {errorText(errors.currency?.message)}
          {errorText(errors.amount?.message)}
        </Card>

        <View style={styles.field}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
            Description
          </ThemedText>
          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <>
                <TextInput
                  accessibilityLabel="Description"
                  autoCapitalize="sentences"
                  maxLength={80}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="e.g. Lunch with friends"
                  placeholderTextColor={theme.textSecondary}
                  returnKeyType="next"
                  style={inputStyle}
                  value={field.value}
                />
                {errorText(fieldState.error?.message)}
              </>
            )}
          />
        </View>

        {suggestion ? (
          <Banner
            tone="info"
            message={`Rule “${suggestion.contains}” suggests ${categoryLabel(suggestion.category)}. Nothing changes unless you tap below.`}
            actionLabel={`Use suggested category: ${categoryLabel(suggestion.category)}`}
            onAction={() =>
              setValue('category', suggestion.category, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
        ) : null}

        <View style={styles.field}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
            Category
          </ThemedText>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <View style={styles.chips}>
                {[
                  ...new Set([
                    ...EXPENSE_CATEGORIES,
                    ...customCategories.map((name) => `custom:${name}` as const),
                    ...(selectedCategory ? [selectedCategory] : []),
                  ]),
                ].map((category) => (
                  <Chip
                    key={category}
                    label={categoryLabel(category)}
                    icon={categoryStyle(category).icon}
                    selected={field.value === category}
                    onPress={() => field.onChange(category)}
                  />
                ))}
              </View>
            )}
          />
        </View>

        {(
          ['accountId', ...(entryType === 'transfer' ? ['toAccountId'] : [])] as (
            'accountId' | 'toAccountId'
          )[]
        ).map((name) => (
          <View key={name} style={styles.field}>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
              {name === 'accountId'
                ? entryType === 'transfer'
                  ? 'From account'
                  : 'Account (optional)'
                : 'To account'}
            </ThemedText>
            <Controller
              control={control}
              name={name}
              render={({ field, fieldState }) => (
                <>
                  <View style={styles.chips}>
                    <Chip
                      label="Unassigned"
                      selected={!field.value}
                      onPress={() => field.onChange('')}
                    />
                    {accounts
                      .filter((account) => !account.archived)
                      .map((account) => (
                        <Chip
                          key={account.id}
                          icon="wallet"
                          label={`${account.name} (${account.currency})`}
                          selected={field.value === account.id}
                          onPress={() => {
                            field.onChange(account.id);
                            if (name === 'accountId') setValue('currency', account.currency);
                          }}
                        />
                      ))}
                  </View>
                  {errorText(fieldState.error?.message)}
                </>
              )}
            />
          </View>
        ))}

        {entryType === 'refund' ? (
          <View style={styles.field}>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
              Original expense
            </ThemedText>
            <Controller
              control={control}
              name="refundOfId"
              render={({ field, fieldState }) => (
                <>
                  <View style={styles.chips}>
                    {originalExpenses
                      .filter(
                        (entry) => !entry.deletedAt && (entry.entryType ?? 'expense') === 'expense',
                      )
                      .map((entry) => (
                        <Chip
                          key={entry.id}
                          label={`${entry.date} · ${entry.description}`}
                          selected={field.value === entry.id}
                          onPress={() => {
                            field.onChange(entry.id);
                            setValue('category', entry.category);
                            setValue('currency', entry.currency ?? 'INR');
                          }}
                        />
                      ))}
                  </View>
                  {errorText(fieldState.error?.message)}
                </>
              )}
            />
          </View>
        ) : null}

        <View style={styles.field}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
            Date
          </ThemedText>
          <Controller
            control={control}
            name="date"
            render={({ field, fieldState }) => (
              <>
                <TextInput
                  accessibilityLabel="Date"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                  style={inputStyle}
                  value={field.value}
                />
                {errorText(fieldState.error?.message)}
              </>
            )}
          />
        </View>

        {(['notes', 'tags'] as const).map((name) => (
          <View key={name} style={styles.field}>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
              {name === 'notes' ? 'Notes' : 'Tags (comma separated)'}
            </ThemedText>
            <Controller
              control={control}
              name={name}
              render={({ field, fieldState }) => (
                <>
                  <TextInput
                    accessibilityLabel={name === 'notes' ? 'Notes' : 'Tags'}
                    placeholder={name === 'notes' ? 'Optional' : 'e.g. trip, work'}
                    placeholderTextColor={theme.textSecondary}
                    style={[inputStyle, name === 'notes' && styles.notes]}
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    multiline={name === 'notes'}
                  />
                  {errorText(fieldState.error?.message)}
                </>
              )}
            />
          </View>
        ))}

        <ReceiptPicker uris={receiptUris} onChange={setReceiptUris} persistFiles={false} />

        {saveError ? <Banner tone="danger" message={saveError} /> : null}

        <Button
          label={submitLabel}
          icon="check"
          loading={isSubmitting}
          onPress={() => handleSubmit((values) => onSave(values, receiptUris))()}
          style={styles.submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    gap: Spacing.four,
    padding: ScreenPadding,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
  field: {
    gap: Spacing.one,
  },
  label: { fontWeight: 600 },
  input: {
    minHeight: 50,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  segments: {
    flexDirection: 'row',
    padding: Spacing.one + 2,
    borderRadius: Radius.lg,
    gap: Spacing.one,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  currency: {
    width: 66,
    minHeight: 42,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 700,
    borderRadius: Radius.md,
  },
  amount: {
    flex: 1,
    fontSize: 34,
    fontWeight: 700,
    minHeight: 52,
    paddingVertical: 0,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  submit: { marginTop: Spacing.two, minHeight: 52 },
});

export function createDefaultExpenseValues(): ExpenseFormValues {
  const now = new Date();
  return {
    description: '',
    amount: '',
    category: 'other',
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  };
}

export function formatExpenseDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
