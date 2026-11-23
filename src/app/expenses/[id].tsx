import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatExpenseDate } from '@/features/expenses/components/expense-form';
import { EXPENSE_CATEGORY_LABELS } from '@/features/expenses/domain/expense';
import { formatMoney } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';

export default function ExpenseDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expense = useExpensesStore((state) => state.expenses.find((item) => item.id === id));
  const status = useExpensesStore((state) => state.status);
  const loadExpenses = useExpensesStore((state) => state.loadExpenses);
  const deleteExpense = useExpensesStore((state) => state.deleteExpense);

  useEffect(() => {
    if (status === 'idle') void loadExpenses();
  }, [loadExpenses, status]);

  async function confirmDelete() {
    try {
      await deleteExpense(id);
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not delete expense',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  function handleDelete() {
    Alert.alert('Delete expense?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void confirmDelete() },
    ]);
  }

  if (!expense) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">
            {status === 'loading' || status === 'idle' ? 'Loading expense…' : 'Expense not found'}
          </ThemedText>
          {status !== 'loading' && status !== 'idle' ? (
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <ThemedText type="linkPrimary">Go back</ThemedText>
            </Pressable>
          ) : null}
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <ThemedText type="linkPrimary">‹ Expenses</ThemedText>
        </Pressable>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            {EXPENSE_CATEGORY_LABELS[expense.category]}
          </ThemedText>
          <ThemedText type="subtitle">{expense.description}</ThemedText>
          <ThemedText type="title">{formatMoney(expense.amount)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatExpenseDate(expense.date)}
          </ThemedText>
        </ThemedView>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/add-expense', params: { id } })}
            style={styles.primaryButton}>
            <ThemedText style={styles.primaryButtonText}>Edit expense</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handleDelete}
            style={styles.secondaryButton}>
            <ThemedText style={styles.deleteText}>Delete expense</ThemedText>
          </Pressable>
        </View>
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
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  actions: {
    gap: Spacing.two,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
    padding: Spacing.three,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    borderColor: '#b42318',
    borderWidth: 1,
    padding: Spacing.three,
  },
  deleteText: {
    color: '#b42318',
    fontWeight: '700',
  },
});
