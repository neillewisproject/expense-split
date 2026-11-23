import { router } from 'expo-router';
import { PieChart } from 'react-native-gifted-charts';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Banner, Button, Card, ScreenHeader } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { categoryStyle } from '@/features/expenses/components/category-style';
import { categoryLabel } from '@/features/expenses/domain/expense';
import { getCategorySpending } from '@/features/expenses/domain/category-spending';
import { formatMoney } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';
import { safeSum } from '@/features/expenses/domain/ledger';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function SpendingByCategoryScreen() {
  const expenses = useExpensesStore((state) => state.expenses);
  const status = useExpensesStore((state) => state.status);
  const loadExpenses = useExpensesStore((state) => state.loadExpenses);
  let data: ReturnType<typeof getCategorySpending> = [];
  let total = 0;
  let positiveTotal = 0;
  let calculationError: string | null = null;
  try {
    data = getCategorySpending(expenses, getCurrentMonth());
    total = safeSum(data.map((item) => item.amount));
    positiveTotal = safeSum(data.filter((item) => item.amount > 0).map((item) => item.amount));
  } catch (error) {
    calculationError = error instanceof Error ? error.message : 'Could not calculate totals';
  }
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
        <ScreenHeader
          onBack={() => router.back()}
          title="Spending by category"
          subtitle={`${monthLabel} · INR only · net personal spending`}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Net spending: {calculationError ? 'unavailable' : formatMoney(total)}. Chart shows
          positive category balances; refund credits are listed separately.
        </ThemedText>

        {calculationError ? (
          <Banner tone="danger" message={calculationError} />
        ) : status === 'loading' && expenses.length === 0 ? (
          <ThemedText themeColor="textSecondary">Loading expenses…</ThemedText>
        ) : status === 'error' && expenses.length === 0 ? (
          <Card>
            <ThemedText type="smallBold">Could not load expenses</ThemedText>
            <Button label="Try again" onPress={() => void loadExpenses()} />
          </Card>
        ) : data.length === 0 ? (
          <Card>
            <ThemedText type="smallBold">No spending this month</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Add an expense to see your category breakdown.
            </ThemedText>
          </Card>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Card style={styles.chartCard}>
              {positiveTotal > 0 ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.chart}>
                  <PieChart
                    data={data
                      .filter((item) => item.amount > 0)
                      .map((item) => ({
                        value: item.amount,
                        color: categoryStyle(item.category).color,
                      }))}
                    donut
                    innerRadius={66}
                    radius={112}
                    centerLabelComponent={() => (
                      <View style={styles.centerLabel}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Positive categories
                        </ThemedText>
                        <ThemedText type="smallBold">{formatMoney(positiveTotal)}</ThemedText>
                      </View>
                    )}
                  />
                </View>
              ) : null}

              <View style={styles.legend}>
                {data.map((item) => {
                  const percentage =
                    item.amount > 0 && positiveTotal > 0
                      ? Math.round((item.amount / positiveTotal) * 100)
                      : 0;
                  return (
                    <View
                      accessible
                      accessibilityLabel={`${categoryLabel(item.category)}, ${item.amount < 0 ? 'refund credit' : `${percentage} percent`}, ${formatMoney(item.amount)}`}
                      key={item.category}
                      style={styles.legendRow}>
                      <View
                        accessibilityElementsHidden
                        style={[
                          styles.legendSwatch,
                          { backgroundColor: categoryStyle(item.category).color },
                        ]}
                      />
                      <ThemedText style={styles.categoryName}>
                        {categoryLabel(item.category)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.amount < 0 ? 'Refund credit' : `${percentage}%`}
                      </ThemedText>
                      <ThemedText type="smallBold" style={styles.categoryAmount}>
                        {formatMoney(item.amount)}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </Card>
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
  content: {
    paddingBottom: Spacing.four,
  },
  chartCard: {
    gap: Spacing.four,
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
});
