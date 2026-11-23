import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Banner,
  Button,
  Card,
  Fab,
  IconBadge,
  IconButton,
  Screen,
  SectionHeader,
  type IconName,
} from '@/components/ui';
import { HeroGradient, Radius, Spacing } from '@/constants/theme';
import { usePersonalStore } from '@/features/accounts/store';
import { useAuth } from '@/features/auth/auth-provider';
import { TransactionRow } from '@/features/expenses/components/expense-list';
import { message } from '@/features/expenses/components/personal-ui';
import { localDate } from '@/features/expenses/domain/expense';
import { filterEntries } from '@/features/expenses/domain/ledger';
import { formatMoney } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';
import { useDueRecurring } from '@/features/recurrence/use-due-recurring';
import { periodReport } from '@/features/reports/domain/reports';
import { useTheme } from '@/hooks/use-theme';

const QUICK_ACTIONS: { label: string; icon: IconName; route: Href }[] = [
  { label: 'Accounts', icon: 'wallet', route: '/accounts' },
  { label: 'Budgets', icon: 'budget', route: '/budgets' },
  { label: 'Goals', icon: 'goal', route: '/goals' },
  { label: 'Recurring', icon: 'recurring', route: '/recurring' },
];

function greeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const entries = useExpensesStore((state) => state.expenses);
  const status = useExpensesStore((state) => state.status);
  const storeError = useExpensesStore((state) => state.error);
  const loadEntries = useExpensesStore((state) => state.loadExpenses);
  const defaultCurrency = usePersonalStore((state) => state.defaultCurrency);
  const drafts = usePersonalStore((state) => state.drafts);
  const recurringError = useDueRecurring();

  useEffect(() => {
    if (status === 'idle') void loadEntries();
  }, [status, loadEntries]);

  const month = localDate().slice(0, 7);
  const summary = useMemo(() => {
    try {
      const active = entries.filter((entry) => !entry.deletedAt);
      const currencies = [...new Set(active.map((entry) => entry.currency ?? 'INR'))];
      const main = currencies.includes(defaultCurrency)
        ? defaultCurrency
        : (currencies[0] ?? defaultCurrency);
      const report = periodReport(entries, month, main);
      const others = currencies
        .filter((code) => code !== main)
        .map((code) => formatMoney(periodReport(entries, month, code).spending, code));
      return { currency: main, report, others, error: null };
    } catch (err) {
      return { error: message(err) };
    }
  }, [entries, defaultCurrency, month]);

  const recent = useMemo(() => filterEntries(entries, {}).slice(0, 5), [entries]);
  const pending = drafts.filter((draft) => draft.status === 'pending').length;
  const name = user?.email?.split('@')[0];
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });

  return (
    <View style={styles.root}>
      <Screen tabBar contentStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText type="small" themeColor="textSecondary">
              {greeting()}
              {name ? `, ${name}` : ''}
            </ThemedText>
            <ThemedText type="title" accessibilityRole="header">
              Expense Split
            </ThemedText>
          </View>
          <IconButton
            icon="settings"
            accessibilityLabel="Preferences"
            onPress={() => router.push('/personal-settings')}
          />
        </View>

        <LinearGradient
          colors={HeroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <ThemedText type="small" style={styles.heroLabel}>
            Spent in {monthName}
          </ThemedText>
          {summary.report ? (
            <>
              <ThemedText style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(summary.report.spending, summary.currency)}
              </ThemedText>
              <View style={styles.heroStats}>
                <HeroStat
                  label="Income"
                  value={formatMoney(summary.report.income, summary.currency)}
                />
                <View style={styles.heroDivider} />
                <HeroStat label="Net" value={formatMoney(summary.report.net, summary.currency)} />
                <View style={styles.heroDivider} />
                <HeroStat label="Transactions" value={String(summary.report.count)} />
              </View>
              {summary.others.length ? (
                <ThemedText type="caption" style={styles.heroLabel}>
                  Also spent {summary.others.join(' · ')}
                </ThemedText>
              ) : null}
            </>
          ) : (
            <ThemedText style={styles.heroLabel}>{summary.error}</ThemedText>
          )}
        </LinearGradient>

        {pending ? (
          <Banner
            tone="warning"
            message={`${pending} recurring ${pending === 1 ? 'item needs' : 'items need'} your approval`}
            actionLabel="Review now"
            onAction={() => router.push('/recurring')}
          />
        ) : null}
        {recurringError || storeError ? (
          <Banner
            tone="danger"
            message={recurringError ?? storeError ?? ''}
            actionLabel="Retry"
            onAction={() => void loadEntries()}
          />
        ) : null}

        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => router.push(action.route)}
              style={({ pressed }) => [
                styles.quickAction,
                { backgroundColor: theme.card, borderColor: theme.border },
                pressed && { opacity: 0.75 },
              ]}>
              <IconBadge icon={action.icon} size={40} />
              <ThemedText type="caption" style={styles.quickLabel}>
                {action.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <SectionHeader
          title="Recent activity"
          action={
            recent.length ? (
              <Button
                variant="ghost"
                label="See all"
                onPress={() => router.navigate('/activity')}
              />
            ) : undefined
          }
        />
        {recent.length ? (
          <Card padded={false}>
            {recent.map((entry, index) => (
              <View
                key={entry.id}
                style={
                  index < recent.length - 1 && {
                    borderBottomColor: theme.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  }
                }>
                <TransactionRow
                  expense={entry}
                  onPress={() =>
                    router.push({ pathname: '/expenses/[id]', params: { id: entry.id } })
                  }
                />
              </View>
            ))}
          </Card>
        ) : (
          <Card style={styles.empty}>
            <IconBadge icon="activity" size={48} />
            <ThemedText type="heading">
              {status === 'loading' ? 'Loading…' : 'Nothing here yet'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Record an expense or income and it will show up here.
            </ThemedText>
          </Card>
        )}
      </Screen>
      <Fab label="Add" onPress={() => router.push('/add-expense')} />
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <ThemedText type="caption" style={styles.heroLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 160 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerText: { flex: 1 },
  hero: {
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  heroLabel: { color: 'rgba(255,255,255,0.82)' },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 700,
    letterSpacing: -0.8,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.35)',
  },
  heroStat: { flex: 1, gap: 2 },
  heroValue: { color: '#FFFFFF' },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginHorizontal: Spacing.two,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  quickActions: { flexDirection: 'row', gap: Spacing.two },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickLabel: { fontWeight: 600 },
  empty: { alignItems: 'center', paddingVertical: Spacing.four },
  center: { textAlign: 'center' },
});
