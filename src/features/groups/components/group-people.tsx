import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-provider';
import { formatMoney } from '@/features/expenses/domain/money';
import { buildPersonLedgers } from '../domain/people';
import { useGroupsStore } from '../store';
import { GroupButton, GroupError, GroupField, GroupPage } from './group-controls';

export function GroupPeopleScreen() {
  const { user } = useAuth();
  const groups = useGroupsStore((state) => state.groups);
  const people = useMemo(() => buildPersonLedgers(groups, user?.id ?? null), [groups, user?.id]);
  const [mine, setMine] = useState('');
  const [other, setOther] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!mine.trim() || !other.trim()) throw new Error('Enter both participant names.');
      if (shared && !user) throw new Error('Sign in before creating a shared ledger.');
      const id = await useGroupsStore
        .getState()
        .createGroup(
          `${mine.trim()} & ${other.trim()}`.slice(0, 80),
          [mine, other],
          shared ? user!.id : undefined,
          currency.trim().toUpperCase(),
          shared ? undefined : 0,
        );
      router.push({ pathname: '/groups/[id]', params: { id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create ledger.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <GroupPage virtualized>
      <GroupButton label="Back to groups" onPress={() => router.back()} />
      <ThemedText type="subtitle">People · two-person ledgers</ThemedText>
      <ThemedText>
        Only verified shared account IDs link identities. Names never merge people. Every group
        permission scope and currency remains separate; balances are never netted across groups.
        Pending/conflicting shared groups are omitted until synchronized and identity claims
        verified.
      </ThemedText>
      {people.length === 0 ? (
        <ThemedText>
          No mapped two-person ledgers yet. Choose “me” in a local group, or have the owner approve
          both shared account claims.
        </ThemedText>
      ) : null}
      {people.map((person) => (
        <GroupPeopleRow key={person.key}>
          <ThemedText type="smallBold">
            {person.names.join(' / ')} ·{' '}
            {person.verifiedUserId ? 'Verified account' : 'Group-local identity only'}
          </ThemedText>
          {person.verifiedUserId ? (
            <ThemedText selectable>{person.verifiedUserId}</ThemedText>
          ) : null}
          {person.scopes.map((scope) => (
            <GroupButton
              key={scope.groupId}
              label={`${scope.groupName}${scope.archived ? ' · archived' : ''}${scope.inactive ? ' · inactive participant' : ''}: ${scope.balance === null ? 'balance cannot be safely displayed' : scope.balance === 0 ? `Settled (${scope.currency})` : `${scope.balance > 0 ? 'Owes you' : 'You owe'} ${formatMoney(Math.abs(scope.balance), scope.currency)}`}`}
              onPress={() =>
                router.push({ pathname: '/groups/[id]', params: { id: scope.groupId } })
              }
            />
          ))}
        </GroupPeopleRow>
      ))}
      <ThemedText type="subtitle">Start a two-person ledger</ThemedText>
      <GroupField
        label="Your participant name (explicit me for local ledger)"
        value={mine}
        onChange={setMine}
      />
      <GroupField label="Other participant name" value={other} onChange={setOther} />
      <GroupField label="Ledger base currency" value={currency} onChange={setCurrency} />
      <GroupButton
        label="Create a new shared ledger (opt-in)"
        selected={shared}
        disabled={!user || busy}
        onPress={() => setShared(!shared)}
      />
      <ThemedText>
        {shared
          ? 'After sync, invite the other account and approve both participant account claims in group settings. Inviting does not claim a participant automatically.'
          : 'Local only. This creates a normal two-participant group and explicitly selects the first participant as you. Existing local groups are never uploaded.'}
      </ThemedText>
      <GroupError error={error} />
      <GroupButton
        label={busy ? 'Creating…' : 'Create two-person ledger'}
        disabled={busy}
        onPress={() => void create()}
      />
    </GroupPage>
  );
}

function GroupPeopleRow({ children }: React.PropsWithChildren) {
  return <View style={{ gap: 8 }}>{children}</View>;
}
