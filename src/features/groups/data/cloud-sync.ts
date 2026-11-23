import { and, asc, eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { getExpenseDatabase } from '@/features/expenses/data/database';
import { getSupabaseClient } from '@/lib/supabase';
import type { Json } from '@/lib/supabase.types';
import type { GroupLedger, GroupWithDetails } from '../domain/group';
import { validateGroupExpense } from '../domain/validation';
import { validateGroupRefunds } from '../domain/refunds';
import { withGroupLock } from './group-lock';
import {
  normalizeReceiptMap,
  readGroups,
  toLedger,
  writeLedger,
  type ReceiptMaps,
} from './local-ledger';
import { groupAccessTombstones, groupExpenses, groupOperations, groups } from './schema';

export type RemoteGroupSnapshot = GroupLedger & {
  inviteCode: string;
  inviteExpiresAt?: string | null;
};

export function parseRemoteGroupSnapshot(value: unknown): RemoteGroupSnapshot {
  if (!value || typeof value !== 'object')
    throw new Error('The server returned an invalid group snapshot.');
  const snapshot = value as RemoteGroupSnapshot;
  if (
    !snapshot.id ||
    !snapshot.inviteCode ||
    !Array.isArray(snapshot.members) ||
    !Array.isArray(snapshot.expenses) ||
    !Array.isArray(snapshot.activity) ||
    !Number.isSafeInteger(snapshot.revision)
  ) {
    throw new Error('The server returned an incomplete group snapshot.');
  }
  for (const expense of snapshot.expenses) validateGroupExpense(snapshot, expense);
  validateGroupRefunds(snapshot);
  return snapshot;
}

export async function fetchRemoteGroups(userId: string): Promise<RemoteGroupSnapshot[]> {
  const client = getSupabaseClient();
  const { data: sessionData } = await client.auth.getSession();
  if (sessionData.session?.user.id !== userId)
    throw new Error('The signed-in account changed. Reload groups.');
  const { data, error } = await client.rpc('get_shared_group_snapshots', {
    p_expected_user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error('The server returned no group snapshots.');
  return data.map(parseRemoteGroupSnapshot);
}

export async function cacheRemoteGroups(
  snapshots: RemoteGroupSnapshot[],
  userId: string,
): Promise<void> {
  const db = await getExpenseDatabase();
  const local = await db.select().from(groups).where(eq(groups.syncUserId, userId));
  const remoteIds = new Set(snapshots.map((snapshot) => snapshot.id));
  for (const removed of local.filter((group) => !remoteIds.has(group.id))) {
    await withGroupLock(removed.id, async () => {
      const [row] = await db.select().from(groups).where(eq(groups.id, removed.id));
      if (!row || row.syncUserId !== userId) return;
      if (!row.inviteCode) return;
      // A query started before an upload may omit a just-created group. Confirm lost access
      // while holding the acknowledgement lock before discarding or pausing any local data.
      const confirmed = await fetchRemoteGroups(userId);
      if (confirmed.some((snapshot) => snapshot.id === row.id)) return;
      if (row.syncStatus === 'synced') {
        db.transaction((tx) => {
          const marker = {
            groupId: row.id,
            userId,
            revision: row.revision,
            createdAt: new Date().toISOString(),
          };
          tx.insert(groupAccessTombstones)
            .values(marker)
            .onConflictDoUpdate({
              target: [groupAccessTombstones.groupId, groupAccessTombstones.userId],
              set: marker,
            })
            .run();
          tx.delete(groups).where(eq(groups.id, row.id)).run();
        });
      } else {
        await db
          .update(groups)
          .set({
            syncStatus: 'conflict',
            conflictMessage:
              'Shared access is no longer available. Local changes are retained but cannot upload.',
          })
          .where(eq(groups.id, row.id));
      }
    });
  }
  for (const supplied of snapshots) {
    await withGroupLock(supplied.id, async () => {
      let snapshot = supplied;
      const [marker] = await db
        .select()
        .from(groupAccessTombstones)
        .where(
          and(
            eq(groupAccessTombstones.groupId, supplied.id),
            eq(groupAccessTombstones.userId, userId),
          ),
        );
      if (marker) {
        const confirmed = (await fetchRemoteGroups(userId)).find(
          (entry) => entry.id === supplied.id,
        );
        if (!confirmed) return;
        snapshot = confirmed;
      }
      const [row] = await db.select().from(groups).where(eq(groups.id, snapshot.id));
      // A pending cache belonging to another account must not be reassigned or overwritten.
      if (row?.syncUserId === null)
        throw new Error(
          'A local-only group uses the same ID as this shared group. Local data has been preserved.',
        );
      if (row && row.syncUserId !== userId && row.syncStatus !== 'synced') {
        throw new Error(
          'This shared group has pending changes for another account on this device. Sign back into that account and resolve its pending changes first.',
        );
      }
      if (row?.syncUserId === userId && row.syncStatus !== 'synced') return;
      if (row?.syncUserId === userId && row.revision > snapshot.revision) return;
      const cachedExpenses = await db
        .select()
        .from(groupExpenses)
        .where(eq(groupExpenses.groupId, snapshot.id));
      const receiptMaps: ReceiptMaps = Object.fromEntries(
        cachedExpenses.map((expense) => [
          expense.id,
          normalizeReceiptMap(expense.receipts, row?.syncUserId ?? 'local'),
        ]),
      );
      const group: GroupWithDetails = {
        ...snapshot,
        inviteExpiresAt: snapshot.inviteExpiresAt ?? null,
        syncUserId: userId,
        syncStatus: 'synced',
        localRevision: row?.localRevision ?? 0,
        expenses: snapshot.expenses.map((expense) => ({
          ...expense,
          receipts: receiptMaps[expense.id]?.[userId] ?? [],
        })),
        meMemberId: snapshot.members.find((member) => member.userId === userId)?.id ?? null,
        conflictMessage: null,
      };
      db.transaction((tx) => {
        // Full authoritative cache replacement also removes obsolete split/member rows.
        tx.delete(groups).where(eq(groups.id, snapshot.id)).run();
        writeLedger(tx, group, receiptMaps);
        tx.delete(groupAccessTombstones)
          .where(
            and(
              eq(groupAccessTombstones.groupId, snapshot.id),
              eq(groupAccessTombstones.userId, userId),
            ),
          )
          .run();
      });
    });
  }
}

export async function syncGroupSnapshot(userId: string, groupId: string): Promise<string> {
  const db = await getExpenseDatabase();
  let inviteCode = '';
  // Drain operations in order. Edits during upload enqueue their own next revision and snapshot.
  for (;;) {
    const operation = await withGroupLock(groupId, async () => {
      const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
      if (!group || group.syncUserId !== userId)
        throw new Error('This group belongs to a different account.');
      if (group.syncStatus === 'conflict')
        throw new Error(group.conflictMessage ?? 'Resolve this group conflict.');
      inviteCode = group.inviteCode ?? '';
      const [next] = await db
        .select()
        .from(groupOperations)
        .where(and(eq(groupOperations.groupId, groupId), eq(groupOperations.userId, userId)))
        .orderBy(asc(groupOperations.localRevision))
        .limit(1);
      if (!next && group.syncStatus === 'pending') {
        // Legacy pending snapshots predate the safe protocol. Do not silently upload unverified authors.
        await db
          .update(groups)
          .set({
            syncStatus: 'conflict',
            conflictMessage:
              'This legacy pending group needs manual recovery/export before cloud editing.',
          })
          .where(eq(groups.id, groupId));
        throw new Error('Legacy pending group cannot upload automatically.');
      }
      return next;
    });
    if (!operation) return inviteCode;
    const client = getSupabaseClient();
    const { data: sessionData } = await client.auth.getSession();
    if (sessionData.session?.user.id !== userId) throw new Error('The signed-in account changed.');
    const { data, error } = await client.rpc('apply_group_operation', {
      p_operation_id: operation.id,
      p_expected_user_id: userId,
      p_group_id: groupId,
      p_base_revision: operation.baseRevision,
      p_snapshot: operation.snapshot as unknown as Json,
    });
    if (error) {
      if (error.message.includes('REVISION_CONFLICT')) {
        await withGroupLock(groupId, async () => {
          await db
            .update(groups)
            .set({
              syncStatus: 'conflict',
              conflictMessage:
                'The shared group changed on another device. Compare the remote version, then keep remote or explicitly retry local changes.',
            })
            .where(and(eq(groups.id, groupId), eq(groups.syncUserId, userId)));
        });
      }
      throw new Error(error.message);
    }
    const result = data as { revision: number; inviteCode: string } | null;
    if (!result || !Number.isSafeInteger(result.revision) || !result.inviteCode)
      throw new Error('The server did not acknowledge this operation.');
    inviteCode = result.inviteCode;
    await withGroupLock(groupId, async () => {
      const remaining = await db
        .select()
        .from(groupOperations)
        .where(eq(groupOperations.groupId, groupId));
      db.transaction((tx) => {
        tx.delete(groupAccessTombstones)
          .where(
            and(
              eq(groupAccessTombstones.groupId, groupId),
              eq(groupAccessTombstones.userId, userId),
            ),
          )
          .run();
        tx.delete(groupOperations)
          .where(and(eq(groupOperations.id, operation.id), eq(groupOperations.userId, userId)))
          .run();
        tx.update(groups)
          .set({
            revision: result.revision,
            inviteCode: result.inviteCode,
            syncStatus: remaining.some((row) => row.id !== operation.id) ? 'pending' : 'synced',
            conflictMessage: null,
          })
          .where(and(eq(groups.id, groupId), eq(groups.syncUserId, userId)))
          .run();
      });
    });
  }
}

export async function resolveGroupConflict(
  userId: string,
  groupId: string,
  choice: 'remote' | 'retry',
): Promise<void> {
  const snapshots = await fetchRemoteGroups(userId);
  const remote = snapshots.find((snapshot) => snapshot.id === groupId);
  if (!remote)
    throw new Error('Shared access is unavailable. Keep local data for manual recovery.');
  await withGroupLock(groupId, async () => {
    const db = await getExpenseDatabase();
    const local = (await readGroups(userId)).find((group) => group.id === groupId);
    if (!local || local.syncStatus !== 'conflict')
      throw new Error('This group has no conflict to resolve.');
    const queued = await db
      .select()
      .from(groupOperations)
      .where(eq(groupOperations.groupId, groupId))
      .orderBy(asc(groupOperations.localRevision));
    const cachedExpenses = await db
      .select()
      .from(groupExpenses)
      .where(eq(groupExpenses.groupId, groupId));
    const receiptMaps: ReceiptMaps = Object.fromEntries(
      cachedExpenses.map((expense) => [expense.id, normalizeReceiptMap(expense.receipts, userId)]),
    );
    if (choice === 'retry' && !queued.length)
      throw new Error(
        'Legacy changes need manual recovery. Keep the remote version only after exporting local data.',
      );
    db.transaction((tx) => {
      tx.delete(groupOperations).where(eq(groupOperations.groupId, groupId)).run();
      if (choice === 'remote') {
        tx.delete(groups).where(eq(groups.id, groupId)).run();
        writeLedger(
          tx,
          {
            ...remote,
            expenses: remote.expenses.map((expense) => ({
              ...expense,
              receipts: local.expenses.find((item) => item.id === expense.id)?.receipts ?? [],
            })),
            syncUserId: userId,
            syncStatus: 'synced',
            localRevision: local.localRevision,
            meMemberId: remote.members.find((member) => member.userId === userId)?.id ?? null,
            conflictMessage: null,
          },
          receiptMaps,
        );
      } else {
        // Manual retry keeps unrelated remote entries and rebases only entries this actor may edit.
        const owner = remote.ownerId === userId;
        const merged: GroupWithDetails = {
          ...local,
          revision: remote.revision,
          localRevision: local.localRevision + 1,
          name: owner ? local.name : remote.name,
          archivedAt: owner ? local.archivedAt : remote.archivedAt,
          members: owner
            ? [
                ...local.members,
                ...remote.members.filter(
                  (member) => !local.members.some((item) => item.id === member.id),
                ),
              ]
            : remote.members,
          expenses: [
            ...remote.expenses.map((expense) => {
              const desired = local.expenses.find((item) => item.id === expense.id);
              const permitted = owner || expense.authorId === userId;
              return desired && permitted
                ? {
                    ...desired,
                    authorId: expense.authorId,
                    createdAt: expense.createdAt,
                    revision: expense.revision + 1,
                    updatedAt: new Date().toISOString(),
                  }
                : { ...expense, receipts: desired?.receipts ?? [] };
            }),
            ...local.expenses
              .filter((expense) => !remote.expenses.some((item) => item.id === expense.id))
              .map((expense) => ({ ...expense, revision: 1 })),
          ],
          activity: [
            ...remote.activity,
            ...local.activity.filter(
              (entry) => !remote.activity.some((item) => item.id === entry.id),
            ),
            {
              id: randomUUID(),
              groupId,
              expenseId: null,
              actorId: userId,
              action: 'conflict_retry',
              text: '',
              details: '',
              createdAt: new Date().toISOString(),
            },
          ],
          syncStatus: 'pending',
          conflictMessage: null,
        };
        writeLedger(tx, merged);
        tx.insert(groupOperations)
          .values({
            id: randomUUID(),
            groupId,
            userId,
            baseRevision: remote.revision,
            localRevision: merged.localRevision,
            snapshot: toLedger(merged),
            createdAt: new Date().toISOString(),
          })
          .run();
      }
    });
  });
}

export async function joinGroupByInvite(inviteCode: string, userId: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('join_group_by_invite', {
    p_invite_code: inviteCode,
    p_expected_user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('The server returned no group for this invitation.');
  return data;
}
