import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-provider';
import { usePersonalStore } from '@/features/accounts/store';
import {
  Action,
  Choices,
  Failure,
  Field,
  PersonalPage,
  message,
} from '@/features/expenses/components/personal-ui';
import { categoryLabel, localDate } from '@/features/expenses/domain/expense';
import { formatMoney } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';
import { useGroupsStore } from '@/features/groups/store';
import { calendarPeriod, previousPeriod, validatePeriod } from '../domain/periods';
import {
  ownGroupConsumption,
  plannedCommitments,
  rangeReport,
  reportComparison,
} from '../domain/reports';

export function ReportsScreen() {
  const entries = useExpensesStore((state) => state.expenses);
  const load = useExpensesStore((state) => state.loadExpenses);
  const error = useExpensesStore((state) => state.error);
  const groups = useGroupsStore((state) => state.groups);
  const groupError = useGroupsStore((state) => state.error);
  const groupStatus = useGroupsStore((state) => state.status);
  const loadGroups = useGroupsStore((state) => state.loadGroups);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const rules = usePersonalStore((state) => state.rules);
  const drafts = usePersonalStore((state) => state.drafts);
  const personalLoaded = usePersonalStore((state) => state.loaded);
  const personalError = usePersonalStore((state) => state.error);
  const loadPersonal = usePersonalStore((state) => state.load);
  const [kind, setKind] = useState<'month' | 'week' | 'year' | 'custom'>('month');
  const [anchor, setAnchor] = useState(localDate());
  const [start, setStart] = useState(`${localDate().slice(0, 7)}-01`);
  const [end, setEnd] = useState(localDate());
  const [currency, setCurrency] = useState('INR');
  useEffect(() => {
    void load();
    void loadPersonal();
  }, [load, loadPersonal]);
  useEffect(() => {
    void loadGroups(userId ?? undefined);
  }, [loadGroups, userId]);
  const result = useMemo(() => {
    try {
      formatMoney(0, currency);
      const period =
        kind === 'custom' ? validatePeriod({ start, end }) : calendarPeriod(kind, anchor);
      const previous = previousPeriod(period, kind);
      const currentReport = rangeReport(entries, period, currency);
      const previousReport = rangeReport(entries, previous, currency);
      return {
        period,
        previous,
        currentReport,
        previousReport,
        change: reportComparison(currentReport, previousReport),
        currentGroup: ownGroupConsumption(groups, period, currency, userId),
        previousGroup: ownGroupConsumption(groups, previous, currency, userId),
        commitments: plannedCommitments(rules, drafts, period, currency),
        error: null,
      };
    } catch (err) {
      return { error: message(err) };
    }
  }, [entries, groups, rules, drafts, kind, anchor, start, end, currency, userId]);
  return (
    <PersonalPage title="Period reports and comparisons">
      <Choices
        value={kind}
        onChange={(value) => setKind(value as typeof kind)}
        values={[
          { value: 'month', label: 'Calendar month' },
          { value: 'week', label: 'Monday–Sunday week' },
          { value: 'year', label: 'Calendar year' },
          { value: 'custom', label: 'Custom dates' },
        ]}
      />
      {kind === 'custom' ? (
        <>
          <Field label="Start date (YYYY-MM-DD, inclusive)" value={start} onChange={setStart} />
          <Field label="End date (YYYY-MM-DD, inclusive)" value={end} onChange={setEnd} />
        </>
      ) : (
        <Field label="Anchor date (YYYY-MM-DD)" value={anchor} onChange={setAnchor} />
      )}
      <Field
        label="Currency"
        value={currency}
        onChange={(value) => setCurrency(value.toUpperCase())}
      />
      <Failure message={result.error ?? error ?? groupError ?? personalError} />
      <ThemedText>
        Calendar dates are inclusive. Custom periods compare against the immediately preceding equal
        number of days; calendar months/years compare against their preceding calendar period.
        Transfers, opening balances and linked group cash movements are excluded from these personal
        ledger totals. Refunds reduce spending when received.
      </ThemedText>
      {result.currentReport && !result.error ? (
        <>
          <ThemedText type="smallBold">
            Current: {result.period.start} through {result.period.end}
          </ThemedText>
          <ThemedText>
            Personal income: {formatMoney(result.currentReport.income, currency)}
          </ThemedText>
          <ThemedText>
            Personal consumption: {formatMoney(result.currentReport.spending, currency)}
          </ThemedText>
          <ThemedText>
            Personal ledger surplus: {formatMoney(result.currentReport.net, currency)}
          </ThemedText>
          <ThemedText type="smallBold">
            Previous: {result.previous.start} through {result.previous.end}
          </ThemedText>
          <ThemedText>
            Personal income: {formatMoney(result.previousReport.income, currency)} · change{' '}
            {formatMoney(result.change.income, currency)}
          </ThemedText>
          <ThemedText>
            Personal consumption: {formatMoney(result.previousReport.spending, currency)} · change{' '}
            {formatMoney(result.change.spending, currency)}
          </ThemedText>
          <ThemedText>
            Personal ledger surplus: {formatMoney(result.previousReport.net, currency)} · change{' '}
            {formatMoney(result.change.net, currency)}
          </ThemedText>
          <ThemedText type="smallBold">Own group shares — separate consumption figure</ThemedText>
          {groupStatus === 'ready' && !groupError ? (
            <ThemedText>
              Current: {formatMoney(result.currentGroup.consumption, currency)} · previous:{' '}
              {formatMoney(result.previousGroup.consumption, currency)}
            </ThemedText>
          ) : (
            <>
              <ThemedText>
                Group consumption is unavailable while loading or until the group load error is
                resolved.
              </ThemedText>
              <Action
                label="Retry loading group shares"
                onPress={() => void loadGroups(userId ?? undefined)}
              />
            </>
          )}
          <ThemedText>
            {result.currentGroup.mappedGroups} mapped groups; {result.currentGroup.unmappedGroups}{' '}
            unmapped groups excluded in {currency}. Claims use your approved member identity or an
            explicit “me” selection, never names. Deleted rows and settlements are excluded; group
            refunds subtract their base-currency share.
          </ThemedText>
          <ThemedText>
            Group shares are NOT added to personal consumption. Personal payments may already
            represent these costs; without transaction linkage, combining them would double count.
          </ThemedText>
          <ThemedText type="smallBold">Unposted recurring commitments</ThemedText>
          {personalLoaded && !personalError ? (
            <>
              <ThemedText>
                Pending drafts and at most the next ungenerated occurrence per active schedule, in
                this period and currency. They are estimates, not included in posted totals.
              </ThemedText>
              {result.commitments.length ? (
                result.commitments.map((item) => (
                  <ThemedText key={item.id}>
                    {item.date} · {item.description} · {formatMoney(item.amount, currency)} ·{' '}
                    {item.entryType} · {item.draft ? 'awaiting approval' : 'next scheduled'}
                  </ThemedText>
                ))
              ) : (
                <ThemedText>No unposted commitments in this period.</ThemedText>
              )}
            </>
          ) : (
            <ThemedText>
              Commitments are unavailable until personal data loads successfully.
            </ThemedText>
          )}
          <ThemedText type="smallBold">Personal category consumption</ThemedText>
          {result.currentReport.categories.map((item) => (
            <ThemedText key={item.category}>
              {categoryLabel(item.category)}: {formatMoney(item.amount, currency)}
            </ThemedText>
          ))}
          <Action
            label="View transactions for these dates"
            onPress={() =>
              router.push({
                pathname: '/activity',
                params: { start: result.period.start, end: result.period.end, currency },
              })
            }
          />
        </>
      ) : null}
    </PersonalPage>
  );
}
