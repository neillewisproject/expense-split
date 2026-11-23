import { useEffect, useState } from 'react';
import { ThemedText } from '@/components/themed-text';
import { usePersonalStore } from '@/features/accounts/store';
import {
  Action,
  Choices,
  Failure,
  Field,
  PersonalPage,
  message,
} from '@/features/expenses/components/personal-ui';
import { localDate } from '@/features/expenses/domain/expense';
import { amountToInput, formatMoney, parseAmount } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';
import { useGroupCashStore } from '@/features/group-cash/store';
import { goalSaved, savingsPosition } from '../domain/goals';
import { useGoalsStore } from '../store';

export function GoalsScreen() {
  const goals = useGoalsStore((state) => state.goals);
  const contributions = useGoalsStore((state) => state.contributions);
  const load = useGoalsStore((state) => state.load);
  const save = useGoalsStore((state) => state.saveGoal);
  const contribute = useGoalsStore((state) => state.contribute);
  const storeError = useGoalsStore((state) => state.error);
  const loaded = useGoalsStore((state) => state.loaded);
  const accounts = usePersonalStore((state) => state.accounts);
  const loadAccounts = usePersonalStore((state) => state.load);
  const accountsLoaded = usePersonalStore((state) => state.loaded);
  const accountsError = usePersonalStore((state) => state.error);
  const entries = useExpensesStore((state) => state.expenses);
  const loadEntries = useExpensesStore((state) => state.loadExpenses);
  const entriesStatus = useExpensesStore((state) => state.status);
  const entriesError = useExpensesStore((state) => state.error);
  const groupCash = useGroupCashStore((state) => state.movements);
  const cashLoaded = useGroupCashStore((state) => state.loaded);
  const cashError = useGroupCashStore((state) => state.error);
  const loadCash = useGroupCashStore((state) => state.load);
  const [editing, setEditing] = useState<string>();
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [goalId, setGoalId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDate());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready =
    loaded &&
    accountsLoaded &&
    cashLoaded &&
    entriesStatus === 'ready' &&
    !storeError &&
    !accountsError &&
    !entriesError &&
    !cashError;
  useEffect(() => {
    void load();
    void loadAccounts();
    void loadEntries();
    void loadCash();
  }, [load, loadAccounts, loadEntries, loadCash]);
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PersonalPage title="Account-backed savings goals">
      <ThemedText>
        Contributions reserve existing cash inside one manual account. They do not move money or
        create income/spending. No investment returns. Deposits require unreserved account cash;
        later expenses may make goals underfunded, which is shown below. Release reservations before
        spending if needed.
      </ThemedText>
      <Failure message={error ?? storeError ?? accountsError ?? entriesError ?? cashError} />
      <Action
        label="Refresh goal balances"
        disabled={busy}
        onPress={() =>
          void run(async () => {
            await load();
            await loadAccounts();
            await loadEntries();
            await loadCash();
          })
        }
      />
      {!ready ? (
        <ThemedText>
          Goal balances are unavailable while loading or until load errors are resolved.
        </ThemedText>
      ) : null}
      {ready
        ? accounts.map((account) => {
            let text: string;
            try {
              const position = savingsPosition(account, goals, contributions, entries, groupCash);
              text = `${account.name}: ${formatMoney(position.balance, account.currency)} cash; ${formatMoney(position.reserved, account.currency)} reserved; ${formatMoney(position.available, account.currency)} unreserved${position.underfunded ? ' — GOALS UNDERFUNDED' : ''}`;
            } catch (err) {
              text = message(err);
            }
            return <ThemedText key={account.id}>{text}</ThemedText>;
          })
        : null}
      {goals.map((goal) => {
        const saved = goalSaved(goal.id, contributions);
        return (
          <ThemedText key={goal.id}>
            {goal.name}: {formatMoney(saved, goal.currency)} /{' '}
            {formatMoney(goal.target, goal.currency)}
            {saved >= goal.target ? ' — target reserved' : ''}
            {goal.targetDate ? ` · target ${goal.targetDate}` : ''}
            {'\n'}
            <ThemedText
              type="linkPrimary"
              onPress={() => {
                setEditing(goal.id);
                setName(goal.name);
                setAccountId(goal.accountId);
                setTarget(amountToInput(goal.target, goal.currency));
                setTargetDate(goal.targetDate ?? '');
              }}>
              Edit goal
            </ThemedText>
          </ThemedText>
        );
      })}
      <ThemedText type="smallBold">{editing ? 'Edit savings goal' : 'New savings goal'}</ThemedText>
      <Field label="Goal name" value={name} onChange={setName} />
      <Choices
        value={accountId}
        onChange={setAccountId}
        values={accounts
          .filter((account) => !account.archived)
          .map((account) => ({
            value: account.id,
            label: `${account.name} (${account.currency})`,
          }))}
      />
      <Field label="Target amount (account currency)" value={target} onChange={setTarget} />
      <Field
        label="Target date (YYYY-MM-DD, optional)"
        value={targetDate}
        onChange={setTargetDate}
      />
      <Action
        label={editing ? 'Save goal changes' : 'Create savings goal'}
        disabled={busy || !ready}
        onPress={() =>
          void run(async () => {
            const account = accounts.find((row) => row.id === accountId);
            if (!account) throw new Error('Choose an account');
            const value = parseAmount(target, account.currency);
            if (value === null) throw new Error('Enter a valid target amount');
            await save(
              {
                name,
                accountId,
                currency: account.currency,
                target: value,
                targetDate: targetDate || null,
              },
              editing,
            );
            setEditing(undefined);
            setName('');
            setTarget('');
            setTargetDate('');
          })
        }
      />
      {editing ? (
        <Action
          label="Cancel goal editing"
          onPress={() => {
            setEditing(undefined);
            setName('');
            setTarget('');
            setTargetDate('');
          }}
        />
      ) : null}
      <ThemedText type="smallBold">Manual reservation or release</ThemedText>
      <Choices
        value={goalId}
        onChange={setGoalId}
        values={goals.map((goal) => ({ value: goal.id, label: `${goal.name} (${goal.currency})` }))}
      />
      <Field label="Contribution amount (positive)" value={amount} onChange={setAmount} />
      <Field label="Contribution date (YYYY-MM-DD)" value={date} onChange={setDate} />
      <Field label="Contribution note" value={note} onChange={setNote} />
      {(['Reserve funds', 'Release funds'] as const).map((label) => (
        <Action
          key={label}
          label={label}
          disabled={busy || !ready}
          onPress={() =>
            void run(async () => {
              const goal = goals.find((row) => row.id === goalId);
              if (!goal) throw new Error('Choose a goal');
              const value = parseAmount(amount, goal.currency);
              if (value === null || value <= 0)
                throw new Error('Enter a positive contribution amount');
              await contribute(goal.id, {
                amount: label === 'Release funds' ? -value : value,
                date,
                note,
              });
              setAmount('');
              setNote('');
            })
          }
        />
      ))}
      <ThemedText type="smallBold">Contribution history</ThemedText>
      {contributions
        .filter((row) => !goalId || row.goalId === goalId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 100)
        .map((row) => {
          const goal = goals.find((item) => item.id === row.goalId);
          return (
            <ThemedText key={row.id}>
              {row.date} · {goal?.name ?? 'Unknown goal'} ·{' '}
              {formatMoney(row.amount, goal?.currency ?? 'INR')} {row.note}
            </ThemedText>
          );
        })}
      <ThemedText type="small">
        History shows the most recent 100 matching contributions.
      </ThemedText>
    </PersonalPage>
  );
}
