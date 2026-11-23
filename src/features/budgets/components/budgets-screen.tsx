import { useEffect, useState } from 'react';
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
import { EXPENSE_CATEGORIES, categoryLabel, localDate } from '@/features/expenses/domain/expense';
import { formatMoney, parseAmount } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';
import { useGroupsStore } from '@/features/groups/store';
import { useGroupCashStore } from '@/features/group-cash/store';
import { budgetProgress } from '@/features/reports/domain/reports';
import { previousMonth } from '@/features/reports/domain/periods';

export function BudgetsScreen() {
  const budgets = usePersonalStore((state) => state.budgets);
  const accounts = usePersonalStore((state) => state.accounts);
  const categories = usePersonalStore((state) => state.categories);
  const load = usePersonalStore((state) => state.load);
  const save = usePersonalStore((state) => state.saveBudget);
  const remove = usePersonalStore((state) => state.deleteBudget);
  const entries = useExpensesStore((state) => state.expenses);
  const loadEntries = useExpensesStore((state) => state.loadExpenses);
  const entriesStatus = useExpensesStore((state) => state.status);
  const entriesError = useExpensesStore((state) => state.error);
  const groups = useGroupsStore((state) => state.groups);
  const groupStatus = useGroupsStore((state) => state.status);
  const groupUser = useGroupsStore((state) => state.activeUserId);
  const groupError = useGroupsStore((state) => state.error);
  const loadGroups = useGroupsStore((state) => state.loadGroups);
  const movements = useGroupCashStore((state) => state.movements);
  const cashLoaded = useGroupCashStore((state) => state.loaded);
  const cashError = useGroupCashStore((state) => state.error);
  const loadCash = useGroupCashStore((state) => state.load);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const storeError = usePersonalStore((state) => state.error);
  const [name, setName] = useState('');
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [currency, setCurrency] = useState('INR');
  const [amount, setAmount] = useState('');
  const [threshold, setThreshold] = useState('80');
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [tag, setTag] = useState('');
  const [carryoverFromId, setCarryoverFromId] = useState('');
  const [basis, setBasis] = useState<'personal' | 'combined'>('personal');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void load();
    void loadEntries();
  }, [load, loadEntries]);
  useEffect(() => {
    void loadGroups(userId ?? undefined);
    void loadCash();
  }, [loadGroups, loadCash, userId]);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const value = parseAmount(amount, currency);
      if (value === null) throw new Error('Enter a valid budget amount');
      await save({
        name,
        month,
        currency,
        amount: value,
        threshold: Number(threshold),
        category: category || null,
        accountId: accountId || null,
        tag: tag.trim() || null,
        carryoverFromId: carryoverFromId || null,
        basis,
      });
      setName('');
      setAmount('');
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PersonalPage title="Monthly budgets">
      <ThemedText>
        Choose personal consumption or personal consumption plus your own group shares. Transfers
        and settlements are excluded; refunds subtract in the month received. Combined budgets
        exclude manually matched personal transactions before adding group shares. Unmatched
        transactions may duplicate group spending; review and match them. Combined budgets cannot
        filter by account or tag. Only groups currently available on this device are included;
        personal backups do not include group ledgers. Carryover requires the same basis and
        filters.
      </ThemedText>
      <Failure message={error ?? storeError} />
      <Action
        label="Refresh budget data"
        disabled={busy}
        onPress={() => {
          void load();
          void loadEntries();
          void loadGroups(userId ?? undefined);
          void loadCash();
        }}
      />
      {budgets.map((budget) => {
        let summary: string;
        try {
          if (entriesStatus !== 'ready' || entriesError)
            throw new Error('Transactions are unavailable; reload before viewing this budget');
          if (
            budget.basis === 'combined' &&
            (groupStatus !== 'ready' ||
              groupUser !== userId ||
              groupError ||
              !cashLoaded ||
              cashError)
          )
            throw new Error('Group data or cash matches are unavailable; reload before combining');
          const progress = budgetProgress(
            budget,
            entries,
            budgets,
            budget.basis === 'combined' ? { groups, movements, userId } : undefined,
          );
          summary = `${formatMoney(progress.spent, budget.currency)} / ${formatMoney(progress.limit ?? budget.amount, budget.currency)} · ${progress.percent}%${progress.warning ? ' · threshold reached' : ''}${progress.carryover ? ` · includes ${formatMoney(progress.carryover, budget.currency)} carried forward` : ''}`;
        } catch (err) {
          summary = message(err);
        }
        return (
          <ThemedText key={budget.id}>
            {budget.name} · {budget.month} ·{' '}
            {budget.basis === 'combined' ? 'personal + group shares' : 'personal only'}
            {'\n'}
            {summary}
            {'\n'}
            <ThemedText
              type="linkPrimary"
              onPress={() => {
                void remove(budget.id).catch((err: unknown) => setError(message(err)));
              }}>
              Remove budget
            </ThemedText>
          </ThemedText>
        );
      })}
      <Field label="Budget name" value={name} onChange={setName} />
      <Field label="Month (YYYY-MM)" value={month} onChange={setMonth} />
      <Field
        label="Currency"
        value={currency}
        onChange={(value) => setCurrency(value.toUpperCase())}
      />
      <Field label="Limit" value={amount} onChange={setAmount} />
      <Field label="Alert threshold percent" value={threshold} onChange={setThreshold} />
      <Choices
        value={basis}
        onChange={(value) => {
          setBasis(value === 'combined' ? 'combined' : 'personal');
          setCarryoverFromId('');
          if (value === 'combined') {
            setAccountId('');
            setTag('');
          }
        }}
        values={[
          { value: 'personal', label: 'Personal consumption only' },
          { value: 'combined', label: 'Personal + own group shares' },
        ]}
      />
      <Choices
        value={category}
        onChange={setCategory}
        values={[
          { value: '', label: 'All categories' },
          ...[...EXPENSE_CATEGORIES, ...categories.map((item) => `custom:${item}`)].map((item) => ({
            value: item,
            label: categoryLabel(item),
          })),
        ]}
      />
      {basis === 'personal' ? (
        <>
          <Choices
            value={accountId}
            onChange={setAccountId}
            values={[
              { value: '', label: 'All accounts' },
              ...accounts.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
          <Field label="Tag filter (optional)" value={tag} onChange={setTag} />
        </>
      ) : null}
      <Choices
        value={carryoverFromId}
        onChange={setCarryoverFromId}
        values={[
          { value: '', label: 'No carryover' },
          ...budgets
            .filter((budget) => {
              try {
                return (
                  budget.month === previousMonth(month) &&
                  budget.currency === currency &&
                  (budget.category ?? '') === category &&
                  (budget.accountId ?? '') === accountId &&
                  (budget.tag ?? '') === tag.trim() &&
                  (budget.basis ?? 'personal') === basis
                );
              } catch {
                return false;
              }
            })
            .map((budget) => ({
              value: budget.id,
              label: `Unused balance from ${budget.name} (${budget.month})`,
            })),
        ]}
      />
      {carryoverFromId ? (
        <ThemedText>
          Carryover source:{' '}
          {budgets.find((budget) => budget.id === carryoverFromId)?.name ?? 'missing'}. Source
          changes recalculate progress; changing filters requires reselecting a matching source.
        </ThemedText>
      ) : null}
      <Action label="Create monthly budget" disabled={busy} onPress={() => void submit()} />
    </PersonalPage>
  );
}
