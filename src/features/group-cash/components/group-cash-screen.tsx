import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-provider';
import { usePersonalStore } from '@/features/accounts/store';
import { formatMoney } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';
import { useGroupsStore } from '@/features/groups/store';
import { GroupButton, GroupError, GroupPage } from '@/features/groups/components/group-controls';
import { groupCashOption, matchesCashTransaction } from '../domain/cash';
import { useGroupCashStore } from '../store';

export function GroupCashScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const group = useGroupsStore((state) => state.groups.find((item) => item.id === id));
  const activeUser = useGroupsStore((state) => state.activeUserId);
  const loadGroups = useGroupsStore((state) => state.loadGroups);
  const groupError = useGroupsStore((state) => state.error);
  const accounts = usePersonalStore((state) => state.accounts);
  const loadAccounts = usePersonalStore((state) => state.load);
  const accountError = usePersonalStore((state) => state.error);
  const movements = useGroupCashStore((state) => state.movements);
  const cashError = useGroupCashStore((state) => state.error);
  const cashLoaded = useGroupCashStore((state) => state.loaded);
  const loadCash = useGroupCashStore((state) => state.load);
  const record = useGroupCashStore((state) => state.record);
  const entries = useExpensesStore((state) => state.expenses);
  const entriesStatus = useExpensesStore((state) => state.status);
  const entriesError = useExpensesStore((state) => state.error);
  const loadEntries = useExpensesStore((state) => state.loadExpenses);
  const [accountId, setAccountId] = useState('');
  const [mode, setMode] = useState<'new' | 'match'>('new');
  const [personalEntryId, setPersonalEntryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadGroups(userId ?? undefined);
    void loadAccounts();
    void loadCash();
    void loadEntries();
  }, [loadGroups, loadAccounts, loadCash, loadEntries, userId]);

  let option: ReturnType<typeof groupCashOption> | null = null;
  let optionError: string | null = null;
  try {
    if (activeUser !== userId) throw new Error('Loading the current account’s groups');
    const expense = group?.expenses.find((row) => row.id === expenseId);
    if (!group || !expense) throw new Error('Group entry is unavailable');
    option = groupCashOption(group, expense, userId);
  } catch (cause) {
    optionError = cause instanceof Error ? cause.message : 'Group cash movement is unavailable';
  }
  const selected = option;
  const existing = selected
    ? movements.find(
        (row) =>
          !row.voidedAt &&
          row.groupId === selected.groupId &&
          row.expenseId === selected.expenseId &&
          row.memberId === selected.memberId &&
          row.direction === selected.direction,
      )
    : undefined;
  const candidates =
    selected && accountId
      ? entries.filter(
          (entry) =>
            matchesCashTransaction({ ...selected, accountId }, entry) &&
            !movements.some(
              (movement) => !movement.voidedAt && movement.personalEntryId === entry.id,
            ),
        )
      : [];

  return (
    <GroupPage>
      <GroupButton label="Back to group" onPress={() => router.back()} />
      <ThemedText type="subtitle">Link an account cash movement</ThemedText>
      <ThemedText>
        Only record cash you actually paid or received. Choose a new account movement or match an
        existing personal transaction with the same account, currency, amount and direction.
        Matching does not change the account balance or personal reporting and never transfers
        money. The snapshot does not change automatically if the group entry is edited or voided.
      </ThemedText>
      <GroupError
        error={
          error ??
          groupError ??
          accountError ??
          cashError ??
          (mode === 'match' ? entriesError : null) ??
          optionError
        }
      />
      {selected ? (
        <>
          <ThemedText>
            {selected.description} · {selected.date} ·{' '}
            {selected.direction === 'out' ? 'you paid' : 'you received'}{' '}
            {formatMoney(selected.amount, selected.currency)} in group base currency.
          </ThemedText>
          {existing ? (
            <ThemedText>
              Already linked to{' '}
              {accounts.find((row) => row.id === existing.accountId)?.name ?? 'an account'}. Review
              or void the snapshot in Manual accounts before recording a correction.
            </ThemedText>
          ) : null}
          <ThemedText type="smallBold">Select an active matching-currency account</ThemedText>
          {accounts
            .filter((account) => !account.archived && account.currency === selected.currency)
            .map((account) => (
              <GroupButton
                key={account.id}
                label={account.name}
                selected={account.id === accountId}
                disabled={busy}
                onPress={() => {
                  setAccountId(account.id);
                  setPersonalEntryId('');
                }}
              />
            ))}
          <GroupButton
            label="Record a new movement"
            selected={mode === 'new'}
            disabled={busy}
            onPress={() => setMode('new')}
          />
          <GroupButton
            label="Match an existing personal transaction"
            selected={mode === 'match'}
            disabled={busy}
            onPress={() => setMode('match')}
          />
          {mode === 'match' ? (
            <>
              <ThemedText>
                Match only the same actual payment or receipt. Partial matches and transfers are not
                supported. The transaction remains in personal consumption or income.
              </ThemedText>
              {entriesStatus === 'ready' &&
              !entriesError &&
              accountId &&
              candidates.length === 0 ? (
                <ThemedText>No eligible unmatched transactions in this account.</ThemedText>
              ) : null}
              {candidates.map((entry) => (
                <GroupButton
                  key={entry.id}
                  label={`${entry.date} · ${entry.description} · ${formatMoney(entry.amount, selected.currency)}`}
                  selected={entry.id === personalEntryId}
                  disabled={busy}
                  onPress={() => setPersonalEntryId(entry.id)}
                />
              ))}
            </>
          ) : null}
          <GroupButton
            label={
              mode === 'match' ? 'Review and match transaction' : 'Review and link cash movement'
            }
            disabled={
              !cashLoaded ||
              !!cashError ||
              !!accountError ||
              !!existing ||
              !accountId ||
              busy ||
              (mode === 'match' &&
                (entriesStatus !== 'ready' ||
                  !!entriesError ||
                  !candidates.some((entry) => entry.id === personalEntryId)))
            }
            onPress={() =>
              Alert.alert(
                'Record this cash movement?',
                mode === 'match'
                  ? 'This links the existing transaction without changing your account balance or the group ledger. Void the match before changing or deleting that transaction.'
                  : `Your selected account will ${selected.direction === 'in' ? 'increase' : 'decrease'} by ${formatMoney(selected.amount, selected.currency)}. This will not change the group ledger.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Record',
                    onPress: () => {
                      setBusy(true);
                      setError(null);
                      void record(
                        selected,
                        accountId,
                        userId,
                        mode === 'match' ? personalEntryId : null,
                      )
                        .then(() => router.back())
                        .catch((cause: unknown) =>
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : 'Could not record cash movement',
                          ),
                        )
                        .finally(() => setBusy(false));
                    },
                  },
                ],
              )
            }
          />
        </>
      ) : null}
    </GroupPage>
  );
}
