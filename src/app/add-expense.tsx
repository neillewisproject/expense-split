import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  ExpenseForm,
  createDefaultExpenseValues,
} from '@/features/expenses/components/expense-form';
import type { ExpenseFormValues } from '@/features/expenses/domain/expense';
import { parseAmount } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const expenses = useExpensesStore((state) => state.expenses);
  const status = useExpensesStore((state) => state.status);
  const loadExpenses = useExpensesStore((state) => state.loadExpenses);
  const saveExpense = useExpensesStore((state) => state.saveExpense);
  const [saveError, setSaveError] = useState<string | null>(null);
  const expense = id ? expenses.find((item) => item.id === id) : undefined;

  useEffect(() => {
    if (id && status === 'idle') void loadExpenses();
  }, [id, loadExpenses, status]);

  async function handleSave(values: ExpenseFormValues) {
    setSaveError(null);
    const amount = parseAmount(values.amount);
    if (amount === null || amount <= 0) {
      setSaveError('Enter an amount greater than zero with up to 2 decimal places.');
      return;
    }
    try {
      await saveExpense(
        {
          description: values.description.trim(),
          amount,
          category: values.category,
          date: values.date,
        },
        id,
      );
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this expense.');
    }
  }

  if (id && (status === 'idle' || status === 'loading')) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText>Loading expense…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (id && !expense) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">Expense not found</ThemedText>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <ThemedText type="linkPrimary">Go back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const initialValues: ExpenseFormValues = expense
    ? {
        description: expense.description,
        amount: (expense.amount / 100).toFixed(2),
        category: expense.category as ExpenseFormValues['category'],
        date: expense.date,
      }
    : createDefaultExpenseValues();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <ThemedText type="linkPrimary">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">{id ? 'Edit expense' : 'Add expense'}</ThemedText>
          <View style={styles.headerSpacer} />
        </View>
        <ExpenseForm
          key={id ?? 'new-expense'}
          initialValues={initialValues}
          onSave={handleSave}
          saveError={saveError}
          submitLabel={id ? 'Save changes' : 'Save expense'}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  headerSpacer: {
    width: 40,
  },
});
