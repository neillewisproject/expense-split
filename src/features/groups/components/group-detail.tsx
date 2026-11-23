import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-provider';
import { computeBalances, simplifyDebts } from '@/features/expenses/domain/balances';
import { amountToInput, formatMoney } from '@/features/expenses/domain/money';
import { getSupabaseClient } from '@/lib/supabase';
import {
  fetchRemoteGroups,
  resolveGroupConflict,
  type RemoteGroupSnapshot,
} from '../data/cloud-sync';
import { canEditExpense, canManageGroup } from '../domain/validation';
import { groupReport, groupSummary } from '../domain/group-report';
import type { GroupMember, GroupWithDetails } from '../domain/group';
import { useGroupsStore } from '../store';
import { GroupButton, GroupError, GroupField, GroupPage } from './group-controls';

export function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const group = useGroupsStore((state) => state.groups.find((item) => item.id === id));
  const status = useGroupsStore((state) => state.status);
  const load = useGroupsStore((state) => state.loadGroups);
  useEffect(() => {
    if (status === 'idle') void load(user?.id);
  }, [status, load, user?.id]);
  if (!group)
    return (
      <GroupPage>
        <ThemedText>
          {status === 'loading' || status === 'idle' ? 'Loading…' : 'Group not found.'}
        </ThemedText>
        <GroupButton label="Back" onPress={() => router.back()} />
      </GroupPage>
    );
  return <Details key={id} group={group} />;
}

function Details({ group }: { group: GroupWithDetails }) {
  const userId = useGroupsStore((state) => state.activeUserId);
  const [name, setName] = useState(group.name);
  const [memberName, setMemberName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trash, setTrash] = useState(false);
  const [manage, setManage] = useState(false);
  const [history, setHistory] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [remote, setRemote] = useState<RemoteGroupSnapshot | null>(null);
  const [access, setAccess] = useState<string[]>([]);
  const balances = useMemo(() => computeBalances(group.expenses), [group.expenses]);
  const suggestions = useMemo(() => simplifyDebts(balances), [balances]);
  const report = useMemo(() => {
    try {
      return { data: groupReport(group), error: null };
    } catch (cause) {
      return { data: null, error: cause instanceof Error ? cause.message : 'Group report failed' };
    }
  }, [group]);
  const summary = useMemo(() => {
    if (!showShare) return { text: null, error: null };
    try {
      return { text: groupSummary(group), error: null };
    } catch (cause) {
      return { text: null, error: cause instanceof Error ? cause.message : 'Group summary failed' };
    }
  }, [group, showShare]);
  const shareText = summary.text;
  const owner = canManageGroup(group, userId);
  const frozen = !!group.archivedAt || group.syncStatus === 'conflict';
  const spending = group.expenses
    .filter((expense) => !expense.deletedAt && expense.kind !== 'settlement')
    .reduce(
      (sum, expense) => sum + BigInt(expense.amount) * (expense.kind === 'refund' ? -1n : 1n),
      0n,
    );
  const spendingText =
    spending <= BigInt(Number.MAX_SAFE_INTEGER)
      ? formatMoney(Number(spending), group.currency)
      : 'Total exceeds the supported display range';

  async function run(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function resolve(choice: 'remote' | 'retry') {
    if (!userId || !remote) return;
    Alert.alert(
      choice === 'remote' ? 'Discard local pending changes?' : 'Retry your local changes?',
      choice === 'remote'
        ? 'The remote version replaces pending changes on this device. Local-only receipts are retained for matching entries.'
        : 'Your editable entries and owner-managed group fields will overwrite their remote counterparts. Other participants’ entries are retained. Authorization is still enforced on the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              await resolveGroupConflict(userId, group.id, choice);
              if (useGroupsStore.getState().activeUserId !== userId) return;
              await useGroupsStore.getState().loadGroups(userId);
              useGroupsStore.getState().retryPendingSync();
              setRemote(null);
            }),
        },
      ],
    );
  }

  return (
    <GroupPage virtualized>
      <GroupButton label="‹ Groups" onPress={() => router.back()} />
      <ThemedText type="subtitle">
        {group.name}
        {group.archivedAt ? ' · Archived' : ''}
      </ThemedText>
      <ThemedText>
        {group.currency} ·{' '}
        {group.syncUserId
          ? `Shared · ${group.syncStatus} · revision ${group.revision}`
          : 'Local only'}
      </ThemedText>
      <ThemedText>Group spending: {spendingText}. Settlements are not spending.</ThemedText>
      <GroupError error={error} />
      {group.conflictMessage ? (
        <>
          <GroupError error={group.conflictMessage} />
          <GroupButton
            label="Compare remote version"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                if (!userId) throw new Error('Sign in first.');
                const latest = (await fetchRemoteGroups(userId)).find(
                  (item) => item.id === group.id,
                );
                if (!latest)
                  throw new Error(
                    'Shared access is no longer available. Local changes remain on this device.',
                  );
                setRemote(latest);
              })
            }
          />
          {remote ? (
            <>
              <ThemedText>
                Remote: {remote.name}, revision {remote.revision},{' '}
                {remote.archivedAt ? 'archived' : 'active'}
              </ThemedText>
              {remote.expenses.map((expense) => (
                <ThemedText key={expense.id}>
                  {expense.description}: {formatMoney(expense.amount, remote.currency)}
                  {expense.deletedAt ? ' (deleted)' : ''}
                </ThemedText>
              ))}
              <GroupButton
                label="Keep remote (discard local pending edits)"
                disabled={busy}
                onPress={() => resolve('remote')}
              />
              <GroupButton
                label="Retry local edits against remote revision"
                disabled={busy}
                onPress={() => resolve('retry')}
              />
            </>
          ) : null}
        </>
      ) : null}
      <GroupButton
        label="+ Add expense"
        disabled={frozen}
        onPress={() =>
          router.push({ pathname: '/groups/[id]/add-expense', params: { id: group.id } })
        }
      />
      <GroupButton
        label="Record custom / partial settlement"
        disabled={frozen}
        onPress={() =>
          router.push({ pathname: '/groups/[id]/settle-up', params: { id: group.id } })
        }
      />
      {group.syncUserId ? (
        <GroupButton
          label="Account access, rotating invitations and ownership"
          onPress={() => router.push({ pathname: '/groups/[id]/access', params: { id: group.id } })}
        />
      ) : (
        <ThemedText>
          {group.syncUserId
            ? 'Share invitation becomes available after sync.'
            : 'Existing local groups stay local. Create a new shared group after signing in.'}
        </ThemedText>
      )}
      <ThemedText type="smallBold">Balances</ThemedText>
      {group.members.map((member) => (
        <ThemedText key={member.id}>
          {member.name}
          {member.id === group.meMemberId || (userId && member.userId === userId) ? ' (me)' : ''}
          {member.deactivatedAt ? ' (inactive)' : ''}:{' '}
          {formatMoney(balances[member.id] ?? 0, group.currency)}
        </ThemedText>
      ))}
      <ThemedText>
        Positive balances get money back; negative balances owe money. Inactive participants retain
        their historical debts.
      </ThemedText>
      <GroupButton
        label={showReport ? 'Hide group breakdown' : 'Show group breakdown'}
        selected={showReport}
        onPress={() => setShowReport(!showReport)}
      />
      {showReport ? (
        report.data ? (
          <>
            <ThemedText>
              Net group spending: {formatMoney(report.data.spending, group.currency)} · recorded
              settlements: {formatMoney(report.data.settlements, group.currency)}. Refunds subtract
              from paid and consumed amounts; settlements are separate.
            </ThemedText>
            {group.members.map((member) => {
              const totals = report.data.members[member.id]!;
              return (
                <ThemedText key={member.id}>
                  {member.name}
                  {member.deactivatedAt ? ' (inactive)' : ''}: paid{' '}
                  {formatMoney(totals.paid, group.currency)}, consumed{' '}
                  {formatMoney(totals.consumed, group.currency)}, settlements sent{' '}
                  {formatMoney(totals.settlementsSent, group.currency)}, received{' '}
                  {formatMoney(totals.settlementsReceived, group.currency)}.
                </ThemedText>
              );
            })}
          </>
        ) : (
          <GroupError error={report.error} />
        )
      ) : null}
      <GroupButton
        label={showShare ? 'Hide shareable summary' : 'Review shareable summary'}
        selected={showShare}
        onPress={() => setShowShare(!showShare)}
      />
      {showShare ? (
        shareText ? (
          <>
            <ThemedText>
              This preview contains group and participant names, balances and suggested repayments.
              Review it before choosing where to share. It excludes entry notes, receipts and invite
              links.
            </ThemedText>
            <ThemedText>{shareText}</ThemedText>
            <GroupButton
              label="Open share sheet"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await Share.share({ message: shareText });
                })
              }
            />
          </>
        ) : (
          <GroupError error={summary.error} />
        )
      ) : null}
      <ThemedText type="smallBold">Suggested repayments</ThemedText>
      <ThemedText>
        Suggestions simplify net debt; they are not guaranteed to use the mathematically fewest
        transfers.
      </ThemedText>
      {suggestions.map((payment) => (
        <GroupButton
          key={`${payment.from}:${payment.to}`}
          label={`${group.members.find((member) => member.id === payment.from)?.name} pays ${group.members.find((member) => member.id === payment.to)?.name} ${formatMoney(payment.amount, group.currency)}`}
          disabled={frozen}
          onPress={() =>
            router.push({
              pathname: '/groups/[id]/settle-up',
              params: {
                id: group.id,
                from: payment.from,
                to: payment.to,
                amount: amountToInput(payment.amount, group.currency),
              },
            })
          }
        />
      ))}
      <GroupButton
        label="Participants and group settings"
        selected={manage}
        onPress={() => setManage(!manage)}
      />
      {manage ? (
        <>
          {!group.syncUserId ? (
            <>
              <ThemedText>
                Explicitly select which participant is you. Names do not establish identity.
              </ThemedText>
              {group.members.map((member) => (
                <GroupButton
                  key={member.id}
                  label={`Me: ${member.name}`}
                  selected={group.meMemberId === member.id}
                  disabled={busy}
                  onPress={() =>
                    void run(() => useGroupsStore.getState().setMe(group.id, member.id))
                  }
                />
              ))}
              <GroupButton
                label="Clear me mapping"
                onPress={() => void run(() => useGroupsStore.getState().setMe(group.id, null))}
              />
            </>
          ) : (
            <ThemedText>
              Shared identities require owner approval. Your account ID: {userId}. Ask the owner to
              assign it to your existing participant, rather than creating a duplicate.
            </ThemedText>
          )}
          {owner ? (
            <>
              <GroupField label="Group name" value={name} onChange={setName} />
              <GroupButton
                label="Rename group"
                disabled={busy || group.syncStatus === 'conflict'}
                onPress={() =>
                  void run(() => useGroupsStore.getState().updateGroup(group.id, { name }))
                }
              />
              <GroupButton
                label={group.archivedAt ? 'Reopen group' : 'Archive group (preserve debts)'}
                disabled={busy || group.syncStatus === 'conflict'}
                onPress={() =>
                  void run(() =>
                    useGroupsStore
                      .getState()
                      .updateGroup(group.id, { archived: !group.archivedAt }),
                  )
                }
              />
              <GroupField
                label="New participant name"
                value={memberName}
                onChange={setMemberName}
              />
              <GroupButton
                label="Add participant"
                disabled={busy || frozen}
                onPress={() =>
                  void run(async () => {
                    await useGroupsStore.getState().addMember(group.id, memberName);
                    setMemberName('');
                  })
                }
              />
              {group.syncUserId ? (
                <GroupButton
                  label="List accounts with shared access"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      const { data, error } = await getSupabaseClient()
                        .from('group_access')
                        .select('user_id')
                        .eq('group_id', group.id);
                      if (error) throw new Error(error.message);
                      setAccess(data?.map((row) => row.user_id) ?? []);
                    })
                  }
                />
              ) : null}
              {access.map((account) => (
                <ThemedText selectable key={account}>
                  {account}
                </ThemedText>
              ))}
              {group.members.map((member) => (
                <ParticipantControl
                  key={`${member.id}:${member.name}:${member.userId}`}
                  groupId={group.id}
                  member={member}
                  shared={!!group.syncUserId}
                  disabled={busy || frozen}
                  run={run}
                />
              ))}
            </>
          ) : null}
        </>
      ) : null}
      <GroupButton
        label={trash ? 'Show active entries' : 'Show deleted / voided entries'}
        onPress={() => setTrash(!trash)}
      />
      <ThemedText type="smallBold">
        {trash ? 'Trash / voided payments' : 'Expenses and payments'}
      </ThemedText>
      {group.expenses
        .filter((expense) => !!expense.deletedAt === trash)
        .map((expense) => (
          <View key={expense.id} style={{ gap: 8 }}>
            <ThemedText type="smallBold">
              {expense.description} · {formatMoney(expense.amount, group.currency)}
            </ThemedText>
            <ThemedText>
              {expense.date} · {expense.kind} · {expense.category} · revision {expense.revision}
            </ThemedText>
            {expense.conversion ? (
              <ThemedText>
                Original:{' '}
                {formatMoney(
                  expense.conversion.originalAmount,
                  expense.conversion.originalCurrency,
                )}{' '}
                · fixed rate {expense.conversion.rate} to {group.currency}
              </ThemedText>
            ) : null}
            {expense.notes ? <ThemedText>{expense.notes}</ThemedText> : null}
            {expense.kind === 'refund' && expense.refundSnapshot ? (
              <ThemedText>
                Linked refund of{' '}
                {group.expenses.find((entry) => entry.id === expense.refundOfId)?.description ??
                  expense.refundOfId}
                :{' '}
                {formatMoney(
                  expense.refundSnapshot.sourceAmount,
                  expense.refundSnapshot.sourceCurrency,
                )}{' '}
                · fixed historical rate {expense.refundSnapshot.rate} · base rounding adjustment{' '}
                {formatMoney(expense.refundSnapshot.baseRoundingAdjustment, group.currency)}
              </ThemedText>
            ) : null}
            {expense.kind === 'expense' &&
            !expense.deletedAt &&
            canEditExpense(group, expense, userId) ? (
              <GroupButton
                label="Record linked full / partial refund"
                disabled={frozen}
                onPress={() =>
                  router.push({
                    pathname: '/groups/[id]/refund',
                    params: { id: group.id, originalId: expense.id },
                  })
                }
              />
            ) : null}
            <ThemedText>
              {group.members
                .map(
                  (member) =>
                    `${member.name}: ${expense.kind === 'refund' ? 'returned' : 'paid'} ${formatMoney(expense.contributions[member.id] ?? 0, group.currency)}, ${expense.kind === 'refund' ? 'owed share reversed' : 'owed'} ${formatMoney(expense.split[member.id] ?? 0, group.currency)}`,
                )
                .join('\n')}
            </ThemedText>
            {!expense.deletedAt ? (
              <GroupButton
                label="Link my cash payment / receipt to an account"
                onPress={() =>
                  router.push({
                    pathname: '/groups/[id]/cash',
                    params: { id: group.id, expenseId: expense.id },
                  })
                }
              />
            ) : null}
            <GroupButton
              label="Entry details / comments"
              onPress={() =>
                router.push({
                  pathname:
                    expense.kind === 'refund' ? '/groups/[id]/refund' : '/groups/[id]/add-expense',
                  params:
                    expense.kind === 'refund'
                      ? { id: group.id, originalId: expense.refundOfId ?? '', refundId: expense.id }
                      : { id: group.id, expenseId: expense.id },
                })
              }
            />
            {canEditExpense(group, expense, userId) ? (
              <>
                <GroupButton
                  label={
                    expense.deletedAt
                      ? 'Restore entry'
                      : expense.kind === 'settlement'
                        ? 'Void payment'
                        : 'Delete entry'
                  }
                  disabled={busy || frozen}
                  onPress={() => {
                    if (expense.deletedAt)
                      void run(() =>
                        useGroupsStore.getState().setExpenseDeleted(group.id, expense.id, false),
                      );
                    else
                      Alert.alert(
                        'Retain entry in trash?',
                        'This removes its balance effect but keeps history and allows restoration.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Confirm',
                            style: 'destructive',
                            onPress: () =>
                              void run(() =>
                                useGroupsStore
                                  .getState()
                                  .setExpenseDeleted(group.id, expense.id, true),
                              ),
                          },
                        ],
                      );
                  }}
                />
              </>
            ) : null}
          </View>
        ))}
      <GroupButton label="Change history" selected={history} onPress={() => setHistory(!history)} />
      {history
        ? group.activity.map((event) => (
            <View key={event.id}>
              <ThemedText>
                {event.action.replace(/_/g, ' ')} · {new Date(event.createdAt).toLocaleString()} ·{' '}
                {event.actorId ?? 'local user'}
              </ThemedText>
              {event.text ? <ThemedText>{event.text}</ThemedText> : null}
              {event.details ? (
                <ThemedText type="small" selectable>
                  {event.details}
                </ThemedText>
              ) : null}
            </View>
          ))
        : null}
    </GroupPage>
  );
}

function ParticipantControl({
  groupId,
  member,
  shared,
  disabled,
  run,
}: {
  groupId: string;
  member: GroupMember;
  shared: boolean;
  disabled: boolean;
  run: (work: () => Promise<unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(member.name);
  const [account, setAccount] = useState(member.userId ?? '');
  return (
    <View style={{ gap: 8 }}>
      <GroupField label={`Rename ${member.name}`} value={name} onChange={setName} />
      <GroupButton
        label="Save participant name"
        disabled={disabled}
        onPress={() =>
          void run(() => useGroupsStore.getState().updateMember(groupId, member.id, { name }))
        }
      />
      <GroupButton
        label={member.deactivatedAt ? `Reactivate ${member.name}` : `Deactivate ${member.name}`}
        disabled={disabled}
        onPress={() =>
          void run(() =>
            useGroupsStore
              .getState()
              .updateMember(groupId, member.id, { active: !!member.deactivatedAt }),
          )
        }
      />
      {shared ? (
        <>
          <GroupField
            label={`Approved account UUID for ${member.name}`}
            value={account}
            onChange={setAccount}
          />
          <GroupButton
            label="Approve / clear identity mapping"
            disabled={disabled}
            onPress={() =>
              void run(() =>
                useGroupsStore
                  .getState()
                  .updateMember(groupId, member.id, { userId: account.trim() || null }),
              )
            }
          />
        </>
      ) : null}
    </View>
  );
}
