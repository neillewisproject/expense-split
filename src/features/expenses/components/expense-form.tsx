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
import { Spacing } from '@/constants/theme';
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

type ExpenseFormProps = {
  initialValues: ExpenseFormValues;
  initialReceiptUris?: string[];
  submitLabel: string;
  saveError: string | null;
  onSave: (values: ExpenseFormValues, receiptUris: string[]) => Promise<void>;
  accounts?: Account[];
  customCategories?: string[];
  originalExpenses?: StoredExpense[];
};

export function ExpenseForm({
  initialValues,
  initialReceiptUris = [],
  submitLabel,
  saveError,
  onSave,
  accounts = [],
  customCategories = [],
  originalExpenses = [],
}: ExpenseFormProps) {
  const theme = useTheme();
  const [receiptUris, setReceiptUris] = useState(initialReceiptUris);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<ExpenseFormRawValues, unknown, ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: initialValues,
  });
  const entryType = useWatch({ control, name: 'entryType' });
  const currency = useWatch({ control, name: 'currency' });

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoidingView}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.field}>
          <ThemedText type="smallBold">Transaction type</ThemedText>
          <Controller
            control={control}
            name="entryType"
            render={({ field }) => (
              <View style={styles.categories}>
                {(['expense', 'income', 'refund', 'transfer'] as const).map((type) => (
                  <Pressable
                    key={type}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: (field.value ?? 'expense') === type }}
                    onPress={() => {
                      field.onChange(type);
                      setValue('toAccountId', '');
                      setValue('refundOfId', '');
                    }}
                    style={styles.categoryButton}>
                    <ThemedText>
                      {(field.value ?? 'expense') === type ? '● ' : '○ '}
                      {type}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </View>
        <View style={styles.field}>
          <ThemedText type="smallBold">Currency (ISO code)</ThemedText>
          <Controller
            control={control}
            name="currency"
            render={({ field, fieldState }) => (
              <>
                <TextInput
                  accessibilityLabel="Currency"
                  style={inputStyle}
                  autoCapitalize="characters"
                  maxLength={3}
                  value={field.value ?? 'INR'}
                  onChangeText={(value) => field.onChange(value.toUpperCase())}
                />
                {fieldState.error ? (
                  <ThemedText accessibilityRole="alert">{fieldState.error.message}</ThemedText>
                ) : null}
              </>
            )}
          />
        </View>
        {(
          ['accountId', ...(entryType === 'transfer' ? ['toAccountId'] : [])] as (
            'accountId' | 'toAccountId'
          )[]
        ).map((name) => (
          <View key={name} style={styles.field}>
            <ThemedText type="smallBold">
              {name === 'accountId' ? 'Account (optional except transfers)' : 'Destination account'}
            </ThemedText>
            <Controller
              control={control}
              name={name}
              render={({ field, fieldState }) => (
                <>
                  <View style={styles.categories}>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.categoryButton}
                      onPress={() => field.onChange('')}>
                      <ThemedText>{!field.value ? '● ' : ''}Unassigned</ThemedText>
                    </Pressable>
                    {accounts
                      .filter((account) => !account.archived)
                      .map((account) => (
                        <Pressable
                          key={account.id}
                          accessibilityRole="button"
                          style={styles.categoryButton}
                          onPress={() => {
                            field.onChange(account.id);
                            if (name === 'accountId') setValue('currency', account.currency);
                          }}>
                          <ThemedText>
                            {field.value === account.id ? '● ' : ''}
                            {account.name} ({account.currency})
                          </ThemedText>
                        </Pressable>
                      ))}
                  </View>
                  {fieldState.error ? (
                    <ThemedText accessibilityRole="alert">{fieldState.error.message}</ThemedText>
                  ) : null}
                </>
              )}
            />
          </View>
        ))}
        {entryType === 'refund' ? (
          <View style={styles.field}>
            <ThemedText type="smallBold">Original expense</ThemedText>
            <Controller
              control={control}
              name="refundOfId"
              render={({ field, fieldState }) => (
                <>
                  {originalExpenses
                    .filter(
                      (entry) => !entry.deletedAt && (entry.entryType ?? 'expense') === 'expense',
                    )
                    .map((entry) => (
                      <Pressable
                        key={entry.id}
                        accessibilityRole="button"
                        style={styles.categoryButton}
                        onPress={() => {
                          field.onChange(entry.id);
                          setValue('category', entry.category);
                          setValue('currency', entry.currency ?? 'INR');
                        }}>
                        <ThemedText>
                          {field.value === entry.id ? '● ' : ''}
                          {entry.date} · {entry.description}
                        </ThemedText>
                      </Pressable>
                    ))}
                  {fieldState.error ? (
                    <ThemedText accessibilityRole="alert">{fieldState.error.message}</ThemedText>
                  ) : null}
                </>
              )}
            />
          </View>
        ) : null}
        <View style={styles.field}>
          <ThemedText type="smallBold">Description</ThemedText>
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
                {fieldState.error ? (
                  <ThemedText accessibilityRole="alert" style={styles.fieldError}>
                    {fieldState.error.message}
                  </ThemedText>
                ) : null}
              </>
            )}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold">Amount ({currency ?? 'INR'})</ThemedText>
          <Controller
            control={control}
            name="amount"
            render={({ field, fieldState }) => (
              <>
                <TextInput
                  accessibilityLabel="Amount"
                  keyboardType="decimal-pad"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  style={inputStyle}
                  value={field.value}
                />
                {fieldState.error ? (
                  <ThemedText accessibilityRole="alert" style={styles.fieldError}>
                    {fieldState.error.message}
                  </ThemedText>
                ) : null}
              </>
            )}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold">Category</ThemedText>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <View style={styles.categories}>
                {[
                  ...EXPENSE_CATEGORIES,
                  ...customCategories.map((name) => `custom:${name}` as const),
                ].map((category) => {
                  const selected = field.value === category;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel={categoryLabel(category)}
                      accessibilityState={{ checked: selected }}
                      key={category}
                      onPress={() => field.onChange(category)}
                      style={[
                        styles.categoryButton,
                        {
                          backgroundColor: selected ? '#3c87f7' : theme.backgroundElement,
                        },
                      ]}>
                      <ThemedText style={selected ? styles.selectedCategoryText : undefined}>
                        {categoryLabel(category)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>

        {(['notes', 'tags'] as const).map((name) => (
          <View key={name} style={styles.field}>
            <ThemedText type="smallBold">
              {name === 'notes' ? 'Notes' : 'Tags (comma separated)'}
            </ThemedText>
            <Controller
              control={control}
              name={name}
              render={({ field, fieldState }) => (
                <>
                  <TextInput
                    accessibilityLabel={name === 'notes' ? 'Notes' : 'Tags'}
                    style={inputStyle}
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    multiline={name === 'notes'}
                  />
                  {fieldState.error ? (
                    <ThemedText accessibilityRole="alert">{fieldState.error.message}</ThemedText>
                  ) : null}
                </>
              )}
            />
          </View>
        ))}
        <View style={styles.field}>
          <ThemedText type="smallBold">Date</ThemedText>
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
                {fieldState.error ? (
                  <ThemedText accessibilityRole="alert" style={styles.fieldError}>
                    {fieldState.error.message}
                  </ThemedText>
                ) : null}
              </>
            )}
          />
        </View>

        <ReceiptPicker uris={receiptUris} onChange={setReceiptUris} persistFiles={false} />

        {saveError ? (
          <ThemedText accessibilityRole="alert" style={styles.fieldError}>
            {saveError}
          </ThemedText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => handleSubmit((values) => onSave(values, receiptUris))()}
          style={[styles.submitButton, isSubmitting && styles.disabledButton]}>
          <ThemedText style={styles.submitButtonText}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  fieldError: {
    color: '#b42318',
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  categoryButton: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  selectedCategoryText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.65,
  },
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
