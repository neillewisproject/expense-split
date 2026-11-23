import { router } from 'expo-router';
import { PieChart } from 'react-native-gifted-charts';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { ExpenseCategory } from '@/features/expenses/domain/expense';
import { EXPENSE_CATEGORY_LABELS } from '@/features/expenses/domain/expense';
import { getCategorySpending } from '@/features/expenses/domain/category-spending';
import { formatMoney } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';

const categoryColors: Record<ExpenseCategory, string> = {
  food: '#f97316',
  transport: '#0ea5e9',
  shopping: '#8b5cf6',
  bills: '#ef4444',
  entertainment: '#22c55e',
  other: '#64748b',
};

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function SpendingByCategoryScreen() {
  const expenses = useExpensesStore((state) => state.expenses);
  const status = useExpensesStore((state) => state.status);
  const loadExpenses = useExpensesStore((state) => state.loadExpenses);
  const data = getCategorySpending(expenses, getCurrentMonth());
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const monthLabel = new Date().toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    if (status === 'idle') void loadExpenses();
  }, [loadExpenses, status]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to expenses"
          onPress={() => router.back()}
          style={styles.backButton}>
          <ThemedText type="linkPrimary">‹ Expenses</ThemedText>
        </Pressable>
        <ThemedText type="subtitle">Spending by category</ThemedText>
        <ThemedText themeColor="textSecondary">{monthLabel}</ThemedText>

        {status === 'loading' && expenses.length === 0 ? (
          <ThemedText themeColor="textSecondary">Loading expenses…</ThemedText>
        ) : status === 'error' && expenses.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <ThemedText type="smallBold">Could not load expenses</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadExpenses()}
              style={styles.retryButton}>
              <ThemedText style={styles.retryButtonText}>Try again</ThemedText>
            </Pressable>
          </ThemedView>
        ) : data.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <ThemedText type="smallBold">No spending this month</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Add an expense to see your category breakdown.
            </ThemedText>
          </ThemedView>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ThemedView type="backgroundElement" style={styles.chartCard}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.chart}>
                <PieChart
                  data={data.map((item) => ({
                    value: item.amount,
                    color: categoryColors[item.category],
                  }))}
                  donut
                  innerRadius={66}
                  radius={112}
                  centerLabelComponent={() => (
                    <View style={styles.centerLabel}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Total
                      </ThemedText>
                      <ThemedText type="smallBold">{formatMoney(total)}</ThemedText>
                    </View>
                  )}
                />
              </View>

              <View style={styles.legend}>
                {data.map((item) => {
                  const percentage = Math.round((item.amount / total) * 100);
                  return (
                    <View
                      accessible
                      accessibilityLabel={`${EXPENSE_CATEGORY_LABELS[item.category]}, ${percentage} percent, ${formatMoney(item.amount)}`}
                      key={item.category}
                      style={styles.legendRow}>
                      <View
                        accessibilityElementsHidden
                        style={[
                          styles.legendSwatch,
                          { backgroundColor: categoryColors[item.category] },
                        ]}
                      />
                      <ThemedText style={styles.categoryName}>
                        {EXPENSE_CATEGORY_LABELS[item.category]}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {percentage}%
                      </ThemedText>
                      <ThemedText type="smallBold" style={styles.categoryAmount}>
                        {formatMoney(item.amount)}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </ThemedView>
          </ScrollView>
        )}
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  content: {
    paddingBottom: Spacing.four,
  },
  chartCard: {
    gap: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  chart: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 230,
  },
  centerLabel: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  legend: {
    gap: Spacing.two,
  },
  legendRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  categoryName: {
    flex: 1,
  },
  categoryAmount: {
    minWidth: 88,
    textAlign: 'right',
  },
  emptyCard: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  retryButton: {
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.three,
  },
  retryButtonText: {
    color: '#ffffff',
  },
});
