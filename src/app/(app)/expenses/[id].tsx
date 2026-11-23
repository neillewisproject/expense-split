import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Divider, IconBadge, ListRow, Screen, ScreenHeader } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { categoryStyle, tint } from '@/features/expenses/components/category-style';
import { useAmountStyle } from '@/features/expenses/components/expense-list';
import { formatExpenseDate } from '@/features/expenses/components/expense-form';
import type { StoredExpense } from '@/features/expenses/data/schema';
import { categoryLabel } from '@/features/expenses/domain/expense';
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
      <Screen header={<ScreenHeader onBack={() => router.back()} title="Transaction" />}>
        <ThemedText themeColor="textSecondary">
          {status === 'loading' || status === 'idle' ? 'Loading…' : 'Transaction not found.'}
        </ThemedText>
      </Screen>
    );
  }

  const accountName = (accountId: string | null | undefined) =>
    accounts.find((account) => account.id === accountId)?.name ?? accountId ?? 'Unassigned';
  const tags = (JSON.parse(expense.tags ?? '[]') as string[]).join(', ');

  return (
    <Screen header={<ScreenHeader onBack={() => router.back()} title="Transaction" />}>
      <Summary expense={expense} />

      <Card padded={false}>
        <ListRow icon="calendar" title="Date" trailing={formatExpenseDate(expense.date)} />
        <Divider />
        <ListRow
          icon="wallet"
          title={expense.toAccountId ? 'From account' : 'Account'}
          trailing={accountName(expense.accountId)}
        />
        {expense.toAccountId ? (
          <>
            <Divider />
            <ListRow
              icon="transfer"
              title="To account"
              trailing={accountName(expense.toAccountId)}
            />
          </>
        ) : null}
        {tags ? (
          <>
            <Divider />
            <ListRow icon="tag" title="Tags" subtitle={tags} />
          </>
        ) : null}
        {expense.notes ? (
          <>
            <Divider />
            <ListRow icon="info" title="Notes" subtitle={expense.notes} />
          </>
        ) : null}
        {expense.refundOfId ? (
          <>
            <Divider />
            <ListRow
              icon="refund"
              title="View original expense"
              onPress={() =>
                router.push({ pathname: '/expenses/[id]', params: { id: expense.refundOfId! } })
              }
            />
          </>
        ) : null}
      </Card>

      {expense.receiptUri ? (
        <Card padded={false}>
          <Image
            accessibilityLabel="Receipt photo"
            contentFit="contain"
            source={{ uri: expense.receiptUri }}
            style={styles.receiptImage}
            transition={150}
          />
        </Card>
      ) : null}

      <View style={styles.actions}>
        {!expense.deletedAt ? (
          <>
            <Button
              icon="edit"
              label="Edit transaction"
              onPress={() => router.push({ pathname: '/add-expense', params: { id } })}
            />
            <Button
              variant="secondary"
              icon="copy"
              label="Duplicate transaction"
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
              }}
            />
          </>
        ) : null}
        <Button
          variant={expense.deletedAt ? 'primary' : 'danger'}
          icon={expense.deletedAt ? 'restore' : 'trash'}
          label={expense.deletedAt ? 'Restore transaction' : 'Move to trash'}
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
        />
      </View>
    </Screen>
  );
}

function Summary({ expense }: { expense: StoredExpense }) {
  const amount = useAmountStyle(expense);
  const visual = categoryStyle(expense.category);
  const type = expense.entryType ?? 'expense';
  return (
    <Card style={styles.summary}>
      <IconBadge
        icon={visual.icon}
        color={visual.color}
        background={tint(visual.color)}
        size={56}
      />
      <ThemedText type="heading" style={styles.center}>
        {expense.description}
      </ThemedText>
      <ThemedText type="title" style={{ color: amount.color }}>
        {amount.text}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {categoryLabel(expense.category)} · {type[0]!.toUpperCase() + type.slice(1)}
        {expense.deletedAt ? ' · In trash' : ''}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: 'center', paddingVertical: Spacing.four },
  center: { textAlign: 'center' },
  receiptImage: {
    width: '100%',
    height: 260,
    borderRadius: Radius.lg,
  },
  actions: {
    gap: Spacing.two,
  },
});
