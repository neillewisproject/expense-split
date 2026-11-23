import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { StoredExpense } from '@/features/expenses/data/schema';
import { EXPENSE_CATEGORY_LABELS } from '@/features/expenses/domain/expense';
import { formatMoney } from '@/features/expenses/domain/money';
import { useTheme } from '@/hooks/use-theme';

type ExpenseListProps = {
  expenses: StoredExpense[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

type ExpenseListRow =
  | { type: 'day'; key: string; date: string }
  | { type: 'expense'; key: string; expense: StoredExpense };

function toListRows(expenses: StoredExpense[]): ExpenseListRow[] {
  const rows: ExpenseListRow[] = [];
  let currentDate: string | null = null;
  for (const expense of expenses) {
    if (expense.date !== currentDate) {
      rows.push({ type: 'day', key: `day-${expense.date}`, date: expense.date });
      currentDate = expense.date;
    }
    rows.push({ type: 'expense', key: expense.id, expense });
  }
  return rows;
}

function formatDayHeading(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function ExpenseList({ expenses, onSelect, onDelete }: ExpenseListProps) {
  const theme = useTheme();
  const rows = toListRows(expenses);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        <EmptyState
          title="No expenses yet"
          message="Add your first expense to start tracking your spending."
        />
      }
      renderItem={({ item }) => {
        if (item.type === 'day') {
          return (
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.dayHeading}>
              {formatDayHeading(item.date)}
            </ThemedText>
          );
        }

        return (
          <ReanimatedSwipeable
            overshootRight={false}
            renderRightActions={() => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.expense.description}`}
                onPress={() => onDelete(item.expense.id)}
                style={styles.deleteAction}>
                <ThemedText style={styles.deleteText}>Delete</ThemedText>
              </Pressable>
            )}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelect(item.expense.id)}
              style={[styles.row, { backgroundColor: theme.background }]}>
              <View style={styles.description}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {item.expense.description}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {EXPENSE_CATEGORY_LABELS[item.expense.category]}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={styles.amount}>
                {formatMoney(item.expense.amount)}
              </ThemedText>
            </Pressable>
          </ReanimatedSwipeable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    paddingBottom: Spacing.three,
  },
  dayHeading: {
    paddingVertical: Spacing.two,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  description: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  amount: {
    flexShrink: 0,
    textAlign: 'right',
  },
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b42318',
  },
  deleteText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
