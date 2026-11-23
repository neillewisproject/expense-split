import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-provider';
import { formatMoney } from '@/features/expenses/domain/money';
import {
  administerGroup,
  fetchGroupAdministration,
  type AdministrationAction,
  type AdministrationResult,
} from '../data/administration';
import type { GroupWithDetails } from '../domain/group';
import { useGroupsStore } from '../store';
import { sharedGroupsQueryKey } from './group-cloud-sync';
import { GroupButton, GroupError, GroupField, GroupPage } from './group-controls';

export function GroupAccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const group = useGroupsStore((state) => state.groups.find((entry) => entry.id === id));
  if (!user || !group || group.syncUserId !== user.id)
    return (
      <GroupPage>
        <GroupButton label="Back" onPress={() => router.back()} />
        <ThemedText>Open a shared group for your signed-in account.</ThemedText>
      </GroupPage>
    );
  return <AccessPanel key={`${id}:${user.id}`} group={group} userId={user.id} />;
}

function AccessPanel({ group, userId }: { group: GroupWithDetails; userId: string }) {
  const query = useQueryClient();
  const [result, setResult] = useState<AdministrationResult | null>(null);
  const [hours, setHours] = useState('168');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState(false);
  const request = useRef<{
    operationId: string;
    revision: number;
    action: AdministrationAction;
  } | null>(null);
  const owner = group.ownerId === userId;
  const ready = group.syncStatus === 'synced' && !busy;

  async function refresh() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await fetchGroupAdministration(userId, group.id));
      request.current = null;
      setPendingRequest(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not load access. This screen requires an online connection.',
      );
      await query.invalidateQueries({ queryKey: sharedGroupsQueryKey(userId) });
    } finally {
      setBusy(false);
    }
  }

  async function perform(action: AdministrationAction, retry = false) {
    if (busy) return;
    if (!retry && request.current) {
      setError(
        'Retry the previous request or refresh access to confirm its outcome before starting another action.',
      );
      return;
    }
    const operation = retry
      ? request.current
      : { operationId: randomUUID(), revision: group.revision, action };
    if (!operation) return;
    request.current = operation;
    setPendingRequest(true);
    setBusy(true);
    setError(null);
    try {
      const response = await administerGroup(
        userId,
        group.id,
        operation.revision,
        operation.operationId,
        operation.action,
      );
      setResult(response);
      request.current = null;
      setPendingRequest(false);
      await query.invalidateQueries({ queryKey: sharedGroupsQueryKey(userId) });
      if (operation.action.action === 'leave') router.replace('/groups');
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : 'Could not confirm the server outcome.'} Retry uses the same operation ID. Refresh confirms current access/revision before another action.`,
      );
      await query.invalidateQueries({ queryKey: sharedGroupsQueryKey(userId) });
    } finally {
      setBusy(false);
    }
  }

  function confirm(action: AdministrationAction) {
    Alert.alert(
      action.action === 'transfer'
        ? 'Transfer group ownership?'
        : action.action === 'leave'
          ? 'Leave this shared group?'
          : 'Remove account access?',
      action.action === 'transfer'
        ? 'The new owner can manage all entries, claims, invites and access. You remain a member. Transfer before an owner can leave.'
        : 'This does NOT forgive debts, send money, erase ledger/history, or deactivate the named participant. The account claim is revoked. Leaving removes this account’s cached ledger; retain any records you need first. Existing downloaded private attachment files are not erased.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Acknowledge and confirm',
          style: 'destructive',
          onPress: () => void perform(action),
        },
      ],
    );
  }

  return (
    <GroupPage virtualized>
      <GroupButton label="Back" onPress={() => router.back()} />
      <ThemedText type="subtitle">Access, invites and ownership</ThemedText>
      <ThemedText>
        {group.name} · {group.currency} · revision {group.revision}
      </ThemedText>
      <ThemedText>
        Online-only. Sync or resolve this group’s entire local queue before administrative changes.
        Changing access retains all named participants, expenses, refunds, payments and history.
      </ThemedText>
      <GroupButton
        label={busy ? 'Working…' : 'Refresh actual account access and invite'}
        disabled={busy}
        onPress={() => void refresh()}
      />
      <GroupError error={error} />
      {pendingRequest && error ? (
        <GroupButton
          label="Retry last administrative request (same ID)"
          disabled={busy}
          onPress={() => void perform(request.current!.action, true)}
        />
      ) : null}
      {result?.access.map((entry) => (
        <GroupPageRow key={entry.userId}>
          <ThemedText selectable>
            {entry.userId === userId ? 'You' : entry.userId} · {entry.role}
          </ThemedText>
          <ThemedText>
            {entry.balance === null
              ? 'No verified participant balance available; do not assume zero debt.'
              : `Mapped participant balance: ${formatMoney(entry.balance, group.currency)}. Positive receives money; negative owes.`}
          </ThemedText>
          {owner && entry.userId !== userId ? (
            <>
              <GroupButton
                label={`Transfer ownership to ${entry.userId}`}
                disabled={!ready}
                onPress={() => confirm({ action: 'transfer', userId: entry.userId })}
              />
              <GroupButton
                label={`Remove access for ${entry.userId}`}
                disabled={!ready || entry.role === 'owner'}
                onPress={() =>
                  confirm({ action: 'remove', userId: entry.userId, acknowledgeLedger: true })
                }
              />
            </>
          ) : null}
        </GroupPageRow>
      ))}
      <ThemedText>
        Invite expiry:{' '}
        {group.inviteExpiresAt
          ? new Date(group.inviteExpiresAt).toLocaleString()
          : 'Refresh to load expiry.'}
      </ThemedText>
      {owner ? (
        <>
          <GroupField
            label="New invite lifetime in whole hours (1–720)"
            value={hours}
            onChange={setHours}
            numeric
          />
          <GroupButton
            label="Rotate invite (invalidates previous link)"
            disabled={!ready}
            onPress={() => {
              const value = Number(hours);
              if (!/^\d+$/.test(hours) || !Number.isInteger(value) || value < 1 || value > 720) {
                setError('Invite lifetime must be 1–720 whole hours.');
                return;
              }
              Alert.alert(
                'Invalidate the previous invitation?',
                'People with the old link will no longer be able to join. Existing member access is unchanged.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Rotate',
                    onPress: () => void perform({ action: 'rotate', hours: value }),
                  },
                ],
              );
            }}
          />
          <GroupButton
            label="Share current unexpired invitation"
            disabled={!ready || !!group.archivedAt}
            onPress={() => {
              setBusy(true);
              setError(null);
              void fetchGroupAdministration(userId, group.id)
                .then(async (response) => {
                  if (useGroupsStore.getState().activeUserId !== userId)
                    throw new Error('The signed-in account changed.');
                  const snapshot = response.snapshot;
                  if (!snapshot || snapshot.ownerId !== userId)
                    throw new Error('Only the current owner can share invitations.');
                  if (
                    snapshot.archivedAt ||
                    !snapshot.inviteExpiresAt ||
                    Date.parse(snapshot.inviteExpiresAt) <= Date.now()
                  )
                    throw new Error(
                      'This invitation is expired or the group is archived. Rotate the invite first.',
                    );
                  setResult(response);
                  const url = Linking.createURL(`/join/${snapshot.inviteCode}`);
                  await Share.share({ message: `Join ${snapshot.name}: ${url}`, url });
                })
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : 'Could not share invitation.'),
                )
                .finally(() => setBusy(false));
            }}
          />
          <ThemedText>
            Only the owner can rotate invites or share through this screen. Bearer invitation links
            can be forwarded by anyone holding them. Transfer ownership before leaving.
          </ThemedText>
        </>
      ) : null}
      <GroupButton
        label="Leave group (retain ledger and debts for remaining members)"
        disabled={!ready || owner}
        onPress={() => confirm({ action: 'leave', acknowledgeLedger: true })}
      />
    </GroupPage>
  );
}

function GroupPageRow({ children }: React.PropsWithChildren) {
  return <View style={{ gap: 8 }}>{children}</View>;
}
