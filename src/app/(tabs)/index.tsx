import { useEffect, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { ExpenseList } from '@/features/expenses/components/expense-list';
import { formatMoney } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';

export default function ExpensesScreen() {
  const expenses = useExpensesStore((state) => state.expenses);
  const status = useExpensesStore((state) => state.status);
  const error = useExpensesStore((state) => state.error);
  const loadExpenses = useExpensesStore((state) => state.loadExpenses);
  const deleteExpense = useExpensesStore((state) => state.deleteExpense);

  useEffect(() => {
    if (status === 'idle') void loadExpenses();
  }, [loadExpenses, status]);

  const monthTotal = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return expenses.reduce(
      (total, expense) => total + (expense.date.startsWith(currentMonth) ? expense.amount : 0),
      0,
    );
  }, [expenses]);

  function confirmDelete(id: string) {
    Alert.alert('Delete expense?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteExpense(id).catch((deleteError: unknown) => {
            Alert.alert(
              'Could not delete expense',
              deleteError instanceof Error ? deleteError.message : 'Please try again.',
            );
          });
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Expenses</ThemedText>

        <ThemedView type="backgroundElement" style={styles.summary}>
          <View style={styles.summaryContent}>
            <View>
              <ThemedText type="small" themeColor="textSecondary">
                Spent this month
              </ThemedText>
              <ThemedText type="subtitle">{formatMoney(monthTotal)}</ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View spending by category"
              onPress={() => router.push('/spending-by-category')}
              style={styles.chartButton}>
              <ThemedText type="smallBold" style={styles.chartButtonText}>
                By category
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>

        {error ? (
          <View accessibilityRole="alert" style={styles.error}>
            <ThemedText type="small">{error}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadExpenses()}
              style={styles.retryButton}>
              <ThemedText style={styles.addButtonText}>Try again</ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.listContainer}>
          {status === 'loading' && expenses.length === 0 ? (
            <ThemedText themeColor="textSecondary">Loading expenses…</ThemedText>
          ) : (
            <ExpenseList
              expenses={expenses}
              onDelete={confirmDelete}
              onSelect={(id) => router.push({ pathname: '/expenses/[id]', params: { id } })}
            />
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add expense"
          onPress={() => router.push('/add-expense')}
          style={styles.addButton}>
          <ThemedText style={styles.addButtonText}>+ Add expense</ThemedText>
        </Pressable>
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
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
  },
  listContainer: {
    flex: 1,
  },
  addButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  summary: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  chartButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.three,
  },
  chartButtonText: {
    color: '#ffffff',
  },
  error: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#fce8e6',
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
