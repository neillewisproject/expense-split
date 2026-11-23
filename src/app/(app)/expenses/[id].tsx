import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatExpenseDate } from '@/features/expenses/components/expense-form';
import { categoryLabel } from '@/features/expenses/domain/expense';
import { formatMoney } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';
import { usePersonalStore } from '@/features/accounts/store';

export default function ExpenseDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expense = useExpensesStore((state) => state.expenses.find((item) => item.id === id));
  const status = useExpensesStore((state) => state.status);
  const loadExpenses = useExpensesStore((state) => state.loadExpenses);
  const deleteExpense = useExpensesStore((state) => state.deleteExpense);
  const duplicateExpense = useExpensesStore((state) => state.duplicateExpense);
  const restoreExpense = useExpensesStore((state) => state.restoreExpense);
  const accounts = usePersonalStore((state) => state.accounts);
  const loadPersonal = usePersonalStore((state) => state.load);

  useEffect(() => {
    if (status === 'idle') void loadExpenses();
  }, [loadExpenses, status]);
  useEffect(() => {
    void loadPersonal();
  }, [loadPersonal]);

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
    Alert.alert(
      'Move to trash?',
      'You can restore this transaction later. Linked refunds must be trashed first.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void confirmDelete() },
      ],
    );
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
        <ScrollView contentContainerStyle={{ gap: Spacing.four, paddingBottom: Spacing.four }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <ThemedText type="linkPrimary">‹ Expenses</ThemedText>
          </Pressable>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">
              {categoryLabel(expense.category)} · {expense.entryType ?? 'expense'}
              {expense.deletedAt ? ' · In trash' : ''}
            </ThemedText>
            <ThemedText type="subtitle">{expense.description}</ThemedText>
            <ThemedText type="title">
              {formatMoney(expense.amount, expense.currency ?? 'INR')}
            </ThemedText>
            {expense.notes ? <ThemedText>{expense.notes}</ThemedText> : null}
            <ThemedText type="small">
              Tags: {(JSON.parse(expense.tags ?? '[]') as string[]).join(', ') || 'none'}
            </ThemedText>
            <ThemedText type="small">
              Account:{' '}
              {accounts.find((account) => account.id === expense.accountId)?.name ?? 'Unassigned'}
            </ThemedText>
            {expense.toAccountId ? (
              <ThemedText type="small">
                Destination:{' '}
                {accounts.find((account) => account.id === expense.toAccountId)?.name ??
                  expense.toAccountId}
              </ThemedText>
            ) : null}
            {expense.refundOfId ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/expenses/[id]', params: { id: expense.refundOfId! } })
                }>
                <ThemedText type="linkPrimary">View original expense</ThemedText>
              </Pressable>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              {formatExpenseDate(expense.date)}
            </ThemedText>
            {expense.receiptUri ? (
              <Image
                accessibilityLabel="Receipt photo"
                contentFit="contain"
                source={{ uri: expense.receiptUri }}
                style={styles.receiptImage}
                transition={150}
              />
            ) : null}
          </ThemedView>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={Boolean(expense.deletedAt)}
              onPress={() => router.push({ pathname: '/add-expense', params: { id } })}
              style={styles.primaryButton}>
              <ThemedText style={styles.primaryButtonText}>Edit expense</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (expense.deletedAt) {
                  void restoreExpense(id).catch((error: unknown) =>
                    Alert.alert(
                      'Could not restore',
                      error instanceof Error ? error.message : 'Try again',
                    ),
                  );
                } else handleDelete();
              }}
              style={styles.secondaryButton}>
              <ThemedText style={styles.deleteText}>
                {expense.deletedAt ? 'Restore transaction' : 'Move to trash'}
              </ThemedText>
            </Pressable>
            {!expense.deletedAt ? (
              <Pressable
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => {
                  void duplicateExpense(id)
                    .then(() =>
                      Alert.alert(
                        'Duplicated',
                        'A new transaction without the receipt photo was saved.',
                      ),
                    )
                    .catch((error: unknown) =>
                      Alert.alert(
                        'Could not duplicate',
                        error instanceof Error ? error.message : 'Try again',
                      ),
                    );
                }}>
                <ThemedText style={styles.primaryButtonText}>Duplicate transaction</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
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
  receiptImage: {
    width: '100%',
    height: 240,
    borderRadius: Spacing.two,
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
