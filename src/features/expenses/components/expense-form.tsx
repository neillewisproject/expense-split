import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
  EXPENSE_CATEGORY_LABELS,
  expenseFormSchema,
  type ExpenseFormValues,
} from '@/features/expenses/domain/expense';
import { useTheme } from '@/hooks/use-theme';

type ExpenseFormProps = {
  initialValues: ExpenseFormValues;
  initialReceiptUri?: string | null;
  submitLabel: string;
  saveError: string | null;
  onSave: (values: ExpenseFormValues, receiptUri: string | null) => Promise<void>;
};

export function ExpenseForm({
  initialValues,
  initialReceiptUri = null,
  submitLabel,
  saveError,
  onSave,
}: ExpenseFormProps) {
  const theme = useTheme();
  const [receiptUri, setReceiptUri] = useState(initialReceiptUri);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: initialValues,
  });

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  async function pickReceipt() {
    setReceiptError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) setReceiptUri(result.assets[0].uri);
    } catch (error) {
      setReceiptError(
        error instanceof Error ? error.message : 'Could not open the photo library. Try again.',
      );
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoidingView}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
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
          <ThemedText type="smallBold">Amount (₹)</ThemedText>
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
                {EXPENSE_CATEGORIES.map((category) => {
                  const selected = field.value === category;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityLabel={EXPENSE_CATEGORY_LABELS[category]}
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
                        {EXPENSE_CATEGORY_LABELS[category]}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>

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

        <View style={styles.field}>
          <ThemedText type="smallBold">Receipt photo</ThemedText>
          {receiptUri ? (
            <Image
              accessibilityLabel="Selected receipt photo"
              contentFit="contain"
              source={{ uri: receiptUri }}
              style={styles.receiptImage}
              transition={150}
            />
          ) : null}
          <View style={styles.receiptActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void pickReceipt()}
              style={styles.receiptButton}>
              <ThemedText type="smallBold">
                {receiptUri ? 'Change receipt photo' : 'Add receipt photo'}
              </ThemedText>
            </Pressable>
            {receiptUri ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove receipt photo"
                onPress={() => setReceiptUri(null)}
                style={styles.receiptButton}>
                <ThemedText type="smallBold">Remove</ThemedText>
              </Pressable>
            ) : null}
          </View>
          {receiptError ? (
            <ThemedText accessibilityRole="alert" style={styles.fieldError}>
              {receiptError}
            </ThemedText>
          ) : null}
        </View>

        {saveError ? (
          <ThemedText accessibilityRole="alert" style={styles.fieldError}>
            {saveError}
          </ThemedText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => void handleSubmit((values) => onSave(values, receiptUri))()}
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
  receiptImage: {
    width: '100%',
    height: 190,
    borderRadius: Spacing.two,
  },
  receiptActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  receiptButton: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
