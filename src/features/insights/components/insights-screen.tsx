import { router, type Href } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Card,
  Divider,
  IconBadge,
  ListRow,
  neu,
  Screen,
  ScreenHeader,
  SectionHeader,
  type IconName,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { usePersonalStore } from '@/features/accounts/store';
import { categoryStyle } from '@/features/expenses/components/category-style';
import { categoryLabel, localDate } from '@/features/expenses/domain/expense';
import { formatMoney } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';
import { periodReport } from '@/features/reports/domain/reports';
import { useTheme } from '@/hooks/use-theme';

const TOOLS: { title: string; subtitle: string; icon: IconName; route: Href }[] = [
  {
    title: 'Spending breakdown',
    subtitle: 'Category chart for any month',
    icon: 'breakdown',
    route: '/spending-by-category',
  },
  {
    title: 'Reports',
    subtitle: 'Compare weeks, months and years',
    icon: 'report',
    route: '/reports',
  },
  {
    title: 'Budgets',
    subtitle: 'Limits, progress and carryover',
    icon: 'budget',
    route: '/budgets',
  },
];

export function InsightsScreen() {
  const theme = useTheme();
  const entries = useExpensesStore((state) => state.expenses);
  const status = useExpensesStore((state) => state.status);
  const loadEntries = useExpensesStore((state) => state.loadExpenses);
  const currency = usePersonalStore((state) => state.defaultCurrency);

  useEffect(() => {
    if (status === 'idle') void loadEntries();
  }, [status, loadEntries]);

  const month = localDate().slice(0, 7);
  const report = useMemo(() => {
    try {
      return periodReport(entries, month, currency);
    } catch {
      return null;
    }
  }, [entries, month, currency]);
  const categories = report?.categories.filter((item) => item.amount > 0).slice(0, 5) ?? [];
  const largest = categories[0]?.amount ?? 0;
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <Screen tabBar header={<ScreenHeader large title="Insights" subtitle={monthName} />}>
      <Card>
        <ThemedText type="caption" themeColor="textSecondary">
          Spent this month ({currency})
        </ThemedText>
        <ThemedText type="title">{formatMoney(report?.spending ?? 0, currency)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Income {formatMoney(report?.income ?? 0, currency)} · Net{' '}
          {formatMoney(report?.net ?? 0, currency)}
        </ThemedText>
      </Card>

      <SectionHeader title="Top categories" />
      <Card>
        {categories.length ? (
          categories.map((item) => {
            const visual = categoryStyle(item.category);
            return (
              <View key={item.category} style={styles.category}>
                <IconBadge icon={visual.icon} color={visual.color} size={36} />
                <View style={styles.categoryBody}>
                  <View style={styles.categoryText}>
                    <ThemedText type="smallBold">{categoryLabel(item.category)}</ThemedText>
                    <ThemedText type="smallBold">{formatMoney(item.amount, currency)}</ThemedText>
                  </View>
                  <View
                    style={[
                      styles.track,
                      { backgroundColor: theme.background },
                      neu(theme, 'insetSm'),
                    ]}>
                    <View
                      style={[
                        styles.bar,
                        {
                          backgroundColor: visual.color,
                          width: `${Math.max(4, Math.round((item.amount / largest) * 100))}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No {currency} spending recorded this month yet.
          </ThemedText>
        )}
      </Card>

      <SectionHeader title="Tools" />
      <Card padded={false}>
        {TOOLS.map((tool, index) => (
          <View key={tool.title}>
            {index ? <Divider /> : null}
            <ListRow
              title={tool.title}
              subtitle={tool.subtitle}
              icon={tool.icon}
              onPress={() => router.push(tool.route)}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  categoryBody: { flex: 1, gap: Spacing.one },
  categoryText: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  track: { height: 12, borderRadius: Radius.pill, overflow: 'hidden', padding: 2 },
  bar: { height: '100%', borderRadius: Radius.pill },
});
