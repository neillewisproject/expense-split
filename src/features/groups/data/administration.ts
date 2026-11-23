import { and, eq } from 'drizzle-orm';
import { getExpenseDatabase } from '@/features/expenses/data/database';
import { getSupabaseClient } from '@/lib/supabase';
import type { Json } from '@/lib/supabase.types';
import { assertAdministrativeReady } from '../domain/administration';
import { useGroupsStore } from '../store';
import { parseRemoteGroupSnapshot, type RemoteGroupSnapshot } from './cloud-sync';
import { withGroupLock } from './group-lock';
import { normalizeReceiptMap, readGroups, writeLedger } from './local-ledger';
import { groupAccessTombstones, groupExpenses, groupOperations, groups } from './schema';

export type GroupAccess = { userId: string; role: 'owner' | 'member'; balance: number | null };
export type AdministrationResult = {
  snapshot: RemoteGroupSnapshot | null;
  access: GroupAccess[];
  revision: number;
};
export type AdministrationAction =
  | { action: 'rotate'; hours: number }
  | { action: 'transfer'; userId: string }
  | { action: 'remove'; userId: string; acknowledgeLedger: true }
  | { action: 'leave'; acknowledgeLedger: true };

function parseResult(data: Json | null): AdministrationResult {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('The server did not acknowledge this administrative operation.');
  const value = data as Record<string, Json>;
  if (!Number.isSafeInteger(value.revision) || !Array.isArray(value.access))
    throw new Error('The server returned incomplete access information.');
  const access = value.access.map((entry): GroupAccess => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      typeof entry.userId !== 'string' ||
      (entry.role !== 'owner' && entry.role !== 'member')
    )
      throw new Error('The server returned invalid group access information.');
    return {
      userId: entry.userId,
      role: entry.role,
      balance:
        typeof entry.balance === 'number' && Number.isSafeInteger(entry.balance)
          ? entry.balance
          : null,
    };
  });
  return {
    snapshot: value.snapshot ? parseRemoteGroupSnapshot(value.snapshot) : null,
    access,
    revision: Number(value.revision),
  };
}

async function cacheAcknowledgement(userId: string, groupId: string, result: AdministrationResult) {
  const db = await getExpenseDatabase();
  const [row] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.syncUserId, userId)));
  if (!row) throw new Error('The local account cache changed. Reload groups.');
  if (!result.snapshot) {
    db.transaction((tx) => {
      const marker = {
        groupId,
        userId,
        revision: result.revision,
        createdAt: new Date().toISOString(),
      };
      tx.insert(groupAccessTombstones)
        .values(marker)
        .onConflictDoUpdate({
          target: [groupAccessTombstones.groupId, groupAccessTombstones.userId],
          set: marker,
        })
        .run();
      tx.delete(groups)
        .where(and(eq(groups.id, groupId), eq(groups.syncUserId, userId)))
        .run();
    });
    return;
  }
  if (result.snapshot.id !== groupId || result.snapshot.revision !== result.revision)
    throw new Error('The server returned a mismatched group acknowledgement.');
  const expenses = await db.select().from(groupExpenses).where(eq(groupExpenses.groupId, groupId));
  const receiptMaps = Object.fromEntries(
    expenses.map((expense) => [expense.id, normalizeReceiptMap(expense.receipts, userId)]),
  );
  const snapshot = result.snapshot;
  db.transaction((tx) => {
    tx.delete(groups).where(eq(groups.id, groupId)).run();
    writeLedger(
      tx,
      {
        ...snapshot,
        inviteExpiresAt: snapshot.inviteExpiresAt ?? null,
        syncUserId: userId,
        syncStatus: 'synced',
        localRevision: row.localRevision,
        meMemberId: snapshot.members.find((member) => member.userId === userId)?.id ?? null,
        conflictMessage: null,
        expenses: snapshot.expenses.map((expense) => ({
          ...expense,
          receipts: receiptMaps[expense.id]?.[userId] ?? [],
        })),
      },
      receiptMaps,
    );
  });
}

export async function fetchGroupAdministration(
  userId: string,
  groupId: string,
): Promise<AdministrationResult> {
  const result = await withGroupLock(groupId, async () => {
    const { data, error } = await getSupabaseClient().rpc('get_group_administration', {
      p_expected_user_id: userId,
      p_group_id: groupId,
    });
    if (error) throw new Error(error.message);
    const response = parseResult(data);
    const db = await getExpenseDatabase();
    const [row] = await db
      .select()
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.syncUserId, userId)));
    const queued = await db
      .select()
      .from(groupOperations)
      .where(eq(groupOperations.groupId, groupId));
    if (row?.syncStatus === 'synced' && queued.length === 0 && response.revision >= row.revision) {
      await cacheAcknowledgement(userId, groupId, response);
    }
    return response;
  });
  if (useGroupsStore.getState().activeUserId === userId)
    await useGroupsStore.getState().loadGroups(userId);
  return result;
}

export async function administerGroup(
  userId: string,
  groupId: string,
  expectedRevision: number,
  operationId: string,
  action: AdministrationAction,
): Promise<AdministrationResult> {
  const result = await withGroupLock(groupId, async () => {
    const db = await getExpenseDatabase();
    const group = (await readGroups(userId)).find((entry) => entry.id === groupId);
    if (!group) throw new Error('Group not found for this account.');
    const queue = await db
      .select()
      .from(groupOperations)
      .where(eq(groupOperations.groupId, groupId));
    assertAdministrativeReady(group, userId, queue.length, action.action !== 'leave');
    if (group.revision !== expectedRevision)
      throw new Error('The local group revision changed. Refresh access before retrying.');
    const args = {
      p_expected_user_id: userId,
      p_operation_id: operationId,
      p_group_id: groupId,
      p_expected_revision: expectedRevision,
    };
    const client = getSupabaseClient();
    const reply =
      action.action === 'rotate'
        ? await client.rpc('rotate_group_invite', { ...args, p_expires_in_hours: action.hours })
        : action.action === 'transfer'
          ? await client.rpc('transfer_group_ownership', {
              ...args,
              p_target_user_id: action.userId,
            })
          : action.action === 'remove'
            ? await client.rpc('remove_group_access', {
                ...args,
                p_target_user_id: action.userId,
                p_acknowledge_ledger: action.acknowledgeLedger,
              })
            : await client.rpc('leave_shared_group', {
                ...args,
                p_acknowledge_ledger: action.acknowledgeLedger,
              });
    if (reply.error) throw new Error(reply.error.message);
    const response = parseResult(reply.data);
    if (response.revision !== expectedRevision + 1)
      throw new Error(
        'The server returned an unexpected administrative revision. Refresh the group to confirm the outcome.',
      );
    await cacheAcknowledgement(userId, groupId, response);
    return response;
  });
  if (useGroupsStore.getState().activeUserId === userId)
    await useGroupsStore.getState().loadGroups(userId);
  return result;
}
