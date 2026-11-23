import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import {
  Action,
  Failure,
  Field,
  PersonalPage,
  message,
} from '@/features/expenses/components/personal-ui';
import { accountBalance } from '@/features/expenses/domain/ledger';
import { amountToInput, formatMoney, parseAmount } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';
import { usePersonalStore } from '../store';
import { useGroupCashStore } from '@/features/group-cash/store';

export function AccountsScreen() {
  const accounts = usePersonalStore((state) => state.accounts);
  const load = usePersonalStore((state) => state.load);
  const save = usePersonalStore((state) => state.saveAccount);
  const loadEntries = useExpensesStore((state) => state.loadExpenses);
  const entries = useExpensesStore((state) => state.expenses);
  const entriesStatus = useExpensesStore((state) => state.status);
  const entriesError = useExpensesStore((state) => state.error);
  const cash = useGroupCashStore((state) => state.movements);
  const cashLoaded = useGroupCashStore((state) => state.loaded);
  const cashError = useGroupCashStore((state) => state.error);
  const loadCash = useGroupCashStore((state) => state.load);
  const voidCash = useGroupCashStore((state) => state.voidMovement);
  const storeError = usePersonalStore((state) => state.error);
  const [id, setId] = useState<string>();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [opening, setOpening] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void load();
    void loadEntries();
    void loadCash();
  }, [load, loadEntries, loadCash]);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const negative = opening.startsWith('-');
      const value = parseAmount(negative ? opening.slice(1) : opening, currency);
      if (value === null) throw new Error('Enter a valid opening balance in the account currency');
      await save(
        { name, currency, openingBalance: negative ? -value : value, archived: false },
        id,
      );
      setId(undefined);
      setName('');
      setOpening('0');
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PersonalPage title="Manual accounts">
      <ThemedText>
        Opening balances are cash balances, not income. Currencies are kept separate. No bank
        connection. Explicitly linked group cash movements change the balance but are not new
        spending or income. Corrections do not change the group ledger.
      </ThemedText>
      <Failure message={error ?? storeError ?? entriesError ?? cashError} />
      <Field label="Account name" value={name} onChange={setName} />
      <Field
        label="Currency"
        value={currency}
        onChange={(value) => setCurrency(value.toUpperCase())}
      />
      <Field label="Opening balance (may be negative)" value={opening} onChange={setOpening} />
      <Action
        label={id ? 'Save account changes' : 'Create account'}
        disabled={busy}
        onPress={() => void submit()}
      />
      {id ? (
        <Action
          label="Cancel editing"
          onPress={() => {
            setId(undefined);
            setName('');
            setOpening('0');
          }}
        />
      ) : null}
      {accounts.map((account) => {
        let balance: string;
        try {
          balance =
            cashLoaded && !cashError && entriesStatus === 'ready' && !entriesError
              ? formatMoney(accountBalance(account, entries, cash), account.currency)
              : 'Balance unavailable until transactions load';
        } catch (err) {
          balance = message(err);
        }
        return (
          <ThemedText
            key={account.id}
            onPress={() => {
              setId(account.id);
              setName(account.name);
              setCurrency(account.currency);
              setOpening(amountToInput(account.openingBalance, account.currency));
            }}>
            {account.name} · {balance}
            {account.archived ? ' (archived)' : ''}
            {'\n'}
            <ThemedText
              type="linkPrimary"
              onPress={() => {
                void save({ ...account, archived: !account.archived }, account.id).catch(
                  (err: unknown) => setError(message(err)),
                );
              }}>
              {account.archived ? 'Reopen' : 'Archive'}
            </ThemedText>
            {' · Tap name to edit'}
          </ThemedText>
        );
      })}
      <ThemedText type="smallBold">Linked group cash movements</ThemedText>
      {cash.map((movement) => (
        <ThemedText key={movement.id}>
          {movement.date} · {movement.groupName} · {movement.description} ·{' '}
          {movement.direction === 'in' ? 'received' : 'paid'}{' '}
          {formatMoney(movement.amount, movement.currency)} ·{' '}
          {accounts.find((account) => account.id === movement.accountId)?.name ?? 'Account missing'}
          {movement.voidedAt ? ' · voided' : ''}
          {movement.personalEntryId ? ' · matched to a personal transaction' : ''}
          {!movement.voidedAt ? (
            <>
              {'\n'}
              <ThemedText
                type="linkPrimary"
                onPress={() =>
                  Alert.alert(
                    'Void this account movement?',
                    movement.personalEntryId
                      ? 'This removes the match. The existing personal transaction and its account effect remain unchanged. The group ledger is not changed.'
                      : 'This reverses its effect on your manual account. It does not change the group ledger or send money.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Void',
                        style: 'destructive',
                        onPress: () =>
                          void voidCash(movement.id).catch((err: unknown) =>
                            setError(message(err)),
                          ),
                      },
                    ],
                  )
                }>
                Void account movement
              </ThemedText>
            </>
          ) : null}
        </ThemedText>
      ))}
    </PersonalPage>
  );
}
