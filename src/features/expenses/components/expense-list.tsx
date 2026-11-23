import type { ReactElement, ReactNode } from 'react';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { Icon, IconBadge } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import type { StoredExpense } from '@/features/expenses/data/schema';
import { categoryLabel, localDate } from '@/features/expenses/domain/expense';
import { formatMoney } from '@/features/expenses/domain/money';
import { useTheme } from '@/hooks/use-theme';

import { categoryStyle, tint } from './category-style';

type ExpenseListProps = {
  expenses: StoredExpense[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  header?: ReactElement;
  footer?: ReactElement;
  bottomInset?: number;
};

type Position = { first: boolean; last: boolean };
type ExpenseListRow =
  | { type: 'day'; key: string; date: string }
  | ({ type: 'expense'; key: string; expense: StoredExpense } & Position);

function toListRows(expenses: StoredExpense[]): ExpenseListRow[] {
  const rows: ExpenseListRow[] = [];
  expenses.forEach((expense, index) => {
    const first = expense.date !== expenses[index - 1]?.date;
    if (first)
      rows.push({ type: 'day', key: `day-${expense.date}-${rows.length}`, date: expense.date });
    const last = expense.date !== expenses[index + 1]?.date;
    rows.push({ type: 'expense', key: expense.id, expense, first, last });
  });
  return rows;
}

export function formatDayHeading(date: string, today = localDate()): string {
  if (date === today) return 'Today';
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === localDate(yesterday)) return 'Yesterday';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Signed, coloured amount: money in is green with “+”, transfers are neutral. */
export function useAmountStyle(expense: StoredExpense) {
  const theme = useTheme();
  const type = expense.entryType ?? 'expense';
  const money = formatMoney(expense.amount, expense.currency ?? 'INR');
  if (type === 'income' || type === 'refund') return { text: `+${money}`, color: theme.success };
  if (type === 'transfer') return { text: money, color: theme.textSecondary };
  return { text: money, color: theme.text };
}

const TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  refund: 'Refund',
  transfer: 'Transfer',
};

export function TransactionRow({
  expense,
  onPress,
  accessibilityLabel,
  role = 'button',
  checked,
  disabled = false,
  position = { first: true, last: true },
}: {
  expense: StoredExpense;
  onPress: () => void;
  accessibilityLabel?: string;
  role?: 'button' | 'checkbox';
  checked?: boolean;
  disabled?: boolean;
  position?: Position;
}) {
  const theme = useTheme();
  const type = expense.entryType ?? 'expense';
  const amount = useAmountStyle(expense);
  const visual =
    type === 'transfer'
      ? { icon: 'transfer' as const, color: '#667085' }
      : type === 'income'
        ? { icon: 'income' as const, color: theme.success }
        : categoryStyle(expense.category);
  let leading: ReactNode = (
    <IconBadge icon={visual.icon} color={visual.color} background={tint(visual.color)} />
  );
  if (role === 'checkbox')
    leading = (
      <Icon
        name={checked ? 'checked' : 'unchecked'}
        size={26}
        color={checked ? theme.accent : theme.textSecondary}
      />
    );
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={
        accessibilityLabel ??
        `${expense.description}, ${categoryLabel(expense.category)}, ${amount.text}`
      }
      accessibilityState={role === 'checkbox' ? { checked, disabled } : { disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.backgroundElement : theme.card },
        position.first && styles.first,
        position.last && styles.last,
      ]}>
      {leading}
      <View style={styles.description}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {expense.description}
        </ThemedText>
        <View style={styles.meta}>
          <ThemedText type="caption" themeColor="textSecondary">
            {categoryLabel(expense.category)}
          </ThemedText>
          {TYPE_LABELS[type] ? (
            <ThemedText type="caption" themeColor="textSecondary">
              · {TYPE_LABELS[type]}
            </ThemedText>
          ) : null}
          {expense.receiptUri ? (
            <Icon name="receipt" size={12} color={theme.textSecondary} />
          ) : null}
        </View>
      </View>
      <ThemedText type="smallBold" style={[styles.amount, { color: amount.color }]}>
        {amount.text}
      </ThemedText>
    </Pressable>
  );
}

export function ExpenseList({
  expenses,
  onSelect,
  onDelete,
  header,
  footer,
  bottomInset = Spacing.three,
}: ExpenseListProps) {
  const theme = useTheme();
  const rows = toListRows(expenses);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        <EmptyState
          title="No transactions yet"
          message="Tap Add to record your first expense or income."
        />
      }
      renderItem={({ item }) => {
        if (item.type === 'day') {
          return (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.dayHeading}>
              {formatDayHeading(item.date)}
            </ThemedText>
          );
        }
        const restoring = Boolean(item.expense.deletedAt);
        return (
          <Animated.View
            entering={FadeInDown.duration(180)}
            exiting={FadeOutUp.duration(150)}
            layout={LinearTransition.springify()}
            style={[
              styles.cell,
              item.first && styles.first,
              item.last && styles.last,
              !item.last && {
                borderBottomColor: theme.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}>
            <ReanimatedSwipeable
              overshootRight={false}
              renderRightActions={() => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${restoring ? 'Restore' : 'Delete'} ${item.expense.description}`}
                  onPress={() => onDelete(item.expense.id)}
                  style={[
                    styles.swipeAction,
                    { backgroundColor: restoring ? theme.success : theme.danger },
                  ]}>
                  <Icon name={restoring ? 'restore' : 'trash'} size={20} color="#FFFFFF" />
                  <ThemedText type="caption" style={styles.swipeText}>
                    {restoring ? 'Restore' : 'Trash'}
                  </ThemedText>
                </Pressable>
              )}>
              <TransactionRow
                expense={item.expense}
                position={item}
                onPress={() => onSelect(item.expense.id)}
              />
            </ReanimatedSwipeable>
          </Animated.View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
  },
  dayHeading: {
    fontWeight: 600,
    letterSpacing: 0.6,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  cell: { overflow: 'hidden' },
  first: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  last: { borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  description: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  amount: {
    flexShrink: 0,
    textAlign: 'right',
  },
  swipeAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  swipeText: {
    color: '#FFFFFF',
    fontWeight: 700,
  },
});
