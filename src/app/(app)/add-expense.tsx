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
import {
  getReceiptUris,
  parseTags,
  type ExpenseFormValues,
} from '@/features/expenses/domain/expense';
import { deleteReceiptFile, persistReceiptFile } from '@/features/expenses/data/receipt-files';
import { amountToInput, parseAmount } from '@/features/expenses/domain/money';
import { usePersonalStore } from '@/features/accounts/store';
import { useExpensesStore } from '@/features/expenses/store';
import { triggerSuccessHaptic } from '@/lib/success-haptics';

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const expenses = useExpensesStore((state) => state.expenses);
  const status = useExpensesStore((state) => state.status);
  const loadExpenses = useExpensesStore((state) => state.loadExpenses);
  const saveExpense = useExpensesStore((state) => state.saveExpense);
  const [saveError, setSaveError] = useState<string | null>(null);
  const expense = id ? expenses.find((item) => item.id === id) : undefined;
  const accounts = usePersonalStore((state) => state.accounts);
  const categories = usePersonalStore((state) => state.categories);
  const categoryRules = usePersonalStore((state) => state.categoryRules);
  const defaultCurrency = usePersonalStore((state) => state.defaultCurrency);
  const loaded = usePersonalStore((state) => state.loaded);
  const loadPersonal = usePersonalStore((state) => state.load);
  const personalError = usePersonalStore((state) => state.error);

  useEffect(() => {
    if (id && status === 'idle') void loadExpenses();
  }, [id, loadExpenses, status]);
  useEffect(() => {
    if (!loaded) void loadPersonal();
  }, [loaded, loadPersonal]);

  async function handleSave(values: ExpenseFormValues, receiptUris: string[]) {
    setSaveError(null);
    const amount = parseAmount(values.amount, values.currency ?? 'INR');
    if (amount === null || amount <= 0) {
      setSaveError('Enter an amount greater than zero with up to 2 decimal places.');
      return;
    }
    const previousUris = expense ? getReceiptUris(expense) : [];
    const newUris: string[] = [];
    try {
      const nextUris: string[] = [];
      for (const uri of receiptUris) {
        if (previousUris.includes(uri)) nextUris.push(uri);
        else {
          const persisted = await persistReceiptFile(uri);
          newUris.push(persisted);
          nextUris.push(persisted);
        }
      }
      await saveExpense(
        {
          description: values.description.trim(),
          amount,
          category: values.category,
          date: values.date,
          receiptUri: nextUris[0] ?? null,
          receiptUris: JSON.stringify(nextUris),
          currency: values.currency ?? 'INR',
          entryType: values.entryType ?? 'expense',
          accountId: values.accountId || null,
          toAccountId: values.toAccountId || null,
          refundOfId: values.refundOfId || null,
          notes: values.notes ?? '',
          tags: JSON.stringify(parseTags(values.tags ?? '')),
        },
        id,
      );
      for (const uri of previousUris.filter((uri) => !nextUris.includes(uri))) {
        try {
          deleteReceiptFile(uri);
        } catch (error) {
          console.warn(
            'Expense saved, but its previous receipt photo could not be removed.',
            error,
          );
        }
      }
      triggerSuccessHaptic();
      router.back();
    } catch (error) {
      for (const uri of newUris) {
        try {
          deleteReceiptFile(uri);
        } catch (cleanupError) {
          console.warn('Could not remove an unsaved receipt photo.', cleanupError);
        }
      }
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
        amount: amountToInput(expense.amount, expense.currency ?? 'INR'),
        category: expense.category as ExpenseFormValues['category'],
        date: expense.date,
        currency: expense.currency ?? 'INR',
        entryType: expense.entryType ?? 'expense',
        accountId: expense.accountId ?? '',
        toAccountId: expense.toAccountId ?? '',
        refundOfId: expense.refundOfId ?? '',
        notes: expense.notes ?? '',
        tags: (JSON.parse(expense.tags ?? '[]') as string[]).join(', '),
      }
    : { ...createDefaultExpenseValues(), currency: defaultCurrency };

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
          key={id ?? `new-expense-${defaultCurrency}`}
          initialValues={initialValues}
          initialReceiptUris={expense ? getReceiptUris(expense) : []}
          onSave={handleSave}
          saveError={saveError ?? personalError}
          accounts={accounts}
          customCategories={categories}
          categoryRules={categoryRules}
          originalExpenses={expenses}
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
