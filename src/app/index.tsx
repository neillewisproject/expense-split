import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatMoney } from '@/features/expenses/domain/money';

export default function ExpensesScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Expenses</ThemedText>

        <ThemedView type="backgroundElement" style={styles.summary}>
          <ThemedText type="small" themeColor="textSecondary">
            Spent this month
          </ThemedText>
          <ThemedText type="subtitle">{formatMoney(0)}</ThemedText>
        </ThemedView>

        <EmptyState
          title="No expenses yet"
          message="Milestone 1: build an “Add expense” form and show expenses here in a FlatList."
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
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  summary: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
});
