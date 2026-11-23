import { router, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { ThemedText } from '@/components/themed-text';
import { amountToInput, formatMoney, parseAmount } from '@/features/expenses/domain/money';
import { calculateGroupRefund, refundBudget } from '../domain/refunds';
import type { GroupWithDetails } from '../domain/group';
import { canEditExpense } from '../domain/validation';
import { useGroupsStore } from '../store';
import { GroupButton, GroupError, GroupField, GroupPage } from './group-controls';

export function GroupRefundEditor() {
  const { id, originalId, refundId } = useLocalSearchParams<{
    id: string;
    originalId: string;
    refundId?: string;
  }>();
  const group = useGroupsStore((state) => state.groups.find((entry) => entry.id === id));
  if (!group)
    return (
      <GroupPage>
        <ThemedText>Group not found. Reload groups.</ThemedText>
        <GroupButton label="Back" onPress={() => router.back()} />
      </GroupPage>
    );
  if (
    refundId &&
    !group.expenses.some(
      (entry) =>
        entry.id === refundId && entry.kind === 'refund' && entry.refundOfId === originalId,
    )
  )
    return (
      <GroupPage>
        <GroupButton label="Back" onPress={() => router.back()} />
        <ThemedText>Linked refund not found.</ThemedText>
      </GroupPage>
    );
  return (
    <RefundForm
      key={`${id}:${refundId ?? 'new'}:${originalId}`}
      group={group}
      originalId={originalId}
      refundId={refundId}
    />
  );
}

function RefundForm({
  group,
  originalId,
  refundId,
}: {
  group: GroupWithDetails;
  originalId: string;
  refundId?: string;
}) {
  const userId = useGroupsStore((state) => state.activeUserId);
  const existing = group.expenses.find((entry) => entry.id === refundId);
  const original = group.expenses.find(
    (entry) => entry.id === originalId && entry.kind === 'expense',
  );
  const sourceCurrency = original?.conversion?.originalCurrency ?? group.currency;
  const [amount, setAmount] = useState(
    existing?.refundSnapshot
      ? amountToInput(existing.refundSnapshot.sourceAmount, sourceCurrency)
      : '',
  );
  const [date, setDate] = useState(
    existing?.date ??
      (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      })(),
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const operation = useRef<string | null>(null);
  let budget: ReturnType<typeof refundBudget> | null = null;
  let budgetError: string | null = null;
  try {
    budget = refundBudget(group, originalId, refundId);
  } catch (cause) {
    budgetError = cause instanceof Error ? cause.message : 'Original expense unavailable.';
  }
  const enabled =
    !!budget &&
    !!original &&
    (!refundId || !!existing) &&
    !existing?.deletedAt &&
    !group.archivedAt &&
    group.syncStatus !== 'conflict' &&
    canEditExpense(group, existing ?? original, userId);

  function sourceAmount() {
    const value = parseAmount(amount, sourceCurrency);
    if (value === null) throw new Error(`Enter a valid amount in ${sourceCurrency}.`);
    return value;
  }

  async function save() {
    if (busy || !enabled) return;
    setBusy(true);
    setError(null);
    try {
      operation.current ??= randomUUID();
      await useGroupsStore
        .getState()
        .recordGroupRefund(
          group.id,
          originalId,
          { sourceAmount: sourceAmount(), date, notes },
          refundId,
          operation.current,
        );
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save refund.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <GroupPage>
      <GroupButton label="Back" onPress={() => router.back()} />
      <ThemedText type="subtitle">{existing ? 'Edit' : 'Record'} linked refund</ThemedText>
      <ThemedText>Original expense: {original?.description ?? 'Unavailable'}</ThemedText>
      <ThemedText>
        Refunds return money to the original payers and reverse the original owed shares. This
        records a refund; it does not move money.
      </ThemedText>
      <GroupError error={budgetError} />
      {budget ? (
        <>
          <ThemedText>
            Remaining original amount: {formatMoney(budget.sourceSplit.total, sourceCurrency)}
          </ThemedText>
          <ThemedText>
            Remaining base amount: {formatMoney(budget.baseSplit.total, group.currency)}
          </ThemedText>
          <ThemedText>
            Fixed historical rate: {budget.source.rate}. A final refund absorbs base rounding
            residue without changing the rate.
          </ThemedText>
          <GroupButton
            label="Refund full remaining amount"
            disabled={!enabled || busy}
            onPress={() => setAmount(amountToInput(budget!.sourceSplit.total, sourceCurrency))}
          />
        </>
      ) : null}
      <GroupField
        label={`Refund amount (${sourceCurrency})`}
        value={amount}
        onChange={setAmount}
        numeric
      />
      <GroupField label="Refund date (YYYY-MM-DD)" value={date} onChange={setDate} />
      <GroupField label="Refund notes" value={notes} onChange={setNotes} multiline />
      <GroupButton
        label="Preview refund allocations"
        disabled={!budget}
        onPress={() => {
          try {
            const result = calculateGroupRefund(group, originalId, sourceAmount(), refundId);
            setPreview(
              `Base refund ${formatMoney(result.amount, group.currency)} · rounding adjustment ${formatMoney(result.refundSnapshot.baseRoundingAdjustment, group.currency)}\n` +
                group.members
                  .map(
                    (member) =>
                      `${member.name}: returned ${formatMoney(result.contributions[member.id] ?? 0, group.currency)}, owed share reversed ${formatMoney(result.split[member.id] ?? 0, group.currency)}`,
                  )
                  .join('\n'),
            );
            setError(null);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Invalid refund.');
          }
        }}
      />
      {preview ? <ThemedText>{preview}</ThemedText> : null}
      {!enabled ? (
        <ThemedText>
          Restore/open the original group and use the original author or owner account. Refund edits
          remain author/owner-managed.
        </ThemedText>
      ) : null}
      <GroupError error={error} />
      <GroupButton
        label={busy ? 'Saving…' : 'Save linked refund'}
        disabled={busy || !enabled}
        onPress={() => void save()}
      />
      {existing ? (
        <>
          <ThemedText type="subtitle">Refund activity and comments</ThemedText>
          {group.activity
            .filter((event) => event.expenseId === existing.id)
            .map((event) => (
              <ThemedText key={event.id}>
                {event.action.replace(/_/g, ' ')} · {event.actorId ?? 'local user'}
                {event.text ? `: ${event.text}` : ''}
              </ThemedText>
            ))}
          <GroupField label="New refund comment" value={comment} onChange={setComment} multiline />
          <GroupButton
            label="Add refund comment"
            disabled={
              busy || !!group.archivedAt || group.syncStatus === 'conflict' || !comment.trim()
            }
            onPress={() => {
              setBusy(true);
              setError(null);
              void useGroupsStore
                .getState()
                .addComment(group.id, existing.id, comment)
                .then(() => setComment(''))
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : 'Could not add comment.'),
                )
                .finally(() => setBusy(false));
            }}
          />
          {group.syncUserId && userId === group.syncUserId ? (
            <GroupButton
              label="Private shared refund receipts (explicit upload only)"
              onPress={() =>
                router.push({
                  pathname: '/shared-receipts',
                  params: { groupId: group.id, expenseId: existing.id },
                })
              }
            />
          ) : null}
        </>
      ) : null}
    </GroupPage>
  );
}
