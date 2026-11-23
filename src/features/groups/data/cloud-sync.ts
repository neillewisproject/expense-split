import { eq, inArray, sql } from 'drizzle-orm';

import { getExpenseDatabase } from '@/features/expenses/data/database';
import { expenseSplits, groupExpenses, groupMembers, groups } from '@/features/groups/data/schema';
import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';

type RemoteGroup = Database['public']['Tables']['groups']['Row'];
type RemoteGroupMember = Database['public']['Tables']['group_members']['Row'];
type RemoteGroupExpense = Database['public']['Tables']['group_expenses']['Row'];
type RemoteExpenseSplit = Database['public']['Tables']['expense_splits']['Row'];

export type RemoteGroupSnapshot = {
  group: RemoteGroup;
  members: RemoteGroupMember[];
  expenses: RemoteGroupExpense[];
  splits: RemoteExpenseSplit[];
};

function throwRemoteError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function fetchRemoteGroups(userId: string): Promise<RemoteGroupSnapshot[]> {
  const client = getSupabaseClient();
  const { data: accessRows, error: accessError } = await client
    .from('group_access')
    .select('group_id')
    .eq('user_id', userId);
  throwRemoteError(accessError);
  if (!accessRows) throw new Error('Supabase returned no group access data.');

  const groupIds = accessRows.map((row) => row.group_id);
  if (groupIds.length === 0) return [];

  const { data: groupRows, error: groupsError } = await client
    .from('groups')
    .select('id,name,created_by,invite_code,created_at')
    .in('id', groupIds);
  throwRemoteError(groupsError);
  if (!groupRows) throw new Error('Supabase returned no group data.');

  const [membersResult, expensesResult] = await Promise.all([
    client.from('group_members').select('id,group_id,name,created_at').in('group_id', groupIds),
    client
      .from('group_expenses')
      .select('id,group_id,description,amount,paid_by_member_id,date,kind,created_at')
      .in('group_id', groupIds),
  ]);
  throwRemoteError(membersResult.error);
  throwRemoteError(expensesResult.error);
  if (!membersResult.data || !expensesResult.data) {
    throw new Error('Supabase returned an incomplete group snapshot.');
  }

  const expenseIds = expensesResult.data.map((expense) => expense.id);
  let splits: RemoteExpenseSplit[] = [];
  if (expenseIds.length > 0) {
    const splitsResult = await client
      .from('expense_splits')
      .select('expense_id,member_id,amount')
      .in('expense_id', expenseIds);
    throwRemoteError(splitsResult.error);
    if (!splitsResult.data) throw new Error('Supabase returned no expense split data.');
    splits = splitsResult.data;
  }

  return groupRows.map((group) => ({
    group,
    members: membersResult.data.filter((member) => member.group_id === group.id),
    expenses: expensesResult.data.filter((expense) => expense.group_id === group.id),
    splits: splits.filter((split) =>
      expensesResult.data.some(
        (expense) => expense.group_id === group.id && expense.id === split.expense_id,
      ),
    ),
  }));
}

export async function cacheRemoteGroups(
  snapshots: RemoteGroupSnapshot[],
  userId: string,
): Promise<void> {
  if (snapshots.length === 0) return;

  const db = await getExpenseDatabase();
  const remoteIds = snapshots.map(({ group }) => group.id);
  const localRows = await db.select().from(groups).where(inArray(groups.id, remoteIds));
  const pendingIds = new Set(
    localRows
      .filter((group) => group.syncUserId === userId && group.syncStatus === 'pending')
      .map((group) => group.id),
  );
  const freshSnapshots = snapshots.filter(({ group }) => !pendingIds.has(group.id));
  if (freshSnapshots.length === 0) return;

  db.transaction((transaction) => {
    transaction
      .insert(groups)
      .values(
        freshSnapshots.map(({ group }) => ({
          id: group.id,
          name: group.name,
          createdAt: group.created_at,
          syncUserId: userId,
          syncStatus: 'synced' as const,
          inviteCode: group.invite_code,
        })),
      )
      .onConflictDoUpdate({
        target: groups.id,
        set: {
          name: sql`excluded.name`,
          syncUserId: sql`excluded.sync_user_id`,
          syncStatus: sql`excluded.sync_status`,
          inviteCode: sql`excluded.invite_code`,
        },
      })
      .run();

    const members = freshSnapshots.flatMap(({ members: items }) =>
      items.map((member) => ({
        id: member.id,
        groupId: member.group_id,
        name: member.name,
        createdAt: member.created_at,
      })),
    );
    if (members.length > 0) {
      transaction
        .insert(groupMembers)
        .values(members)
        .onConflictDoUpdate({
          target: groupMembers.id,
          set: { name: sql`excluded.name` },
        })
        .run();
    }

    const remoteExpenses = freshSnapshots.flatMap(({ expenses: items }) =>
      items.map((expense) => ({
        id: expense.id,
        groupId: expense.group_id,
        description: expense.description,
        amount: expense.amount,
        paidByMemberId: expense.paid_by_member_id,
        date: expense.date,
        kind: expense.kind,
        createdAt: expense.created_at,
      })),
    );
    if (remoteExpenses.length > 0) {
      transaction
        .insert(groupExpenses)
        .values(remoteExpenses)
        .onConflictDoUpdate({
          target: groupExpenses.id,
          set: {
            description: sql`excluded.description`,
            amount: sql`excluded.amount`,
          },
        })
        .run();
    }

    const remoteSplits = freshSnapshots.flatMap(({ splits: items }) =>
      items.map((split) => ({
        expenseId: split.expense_id,
        memberId: split.member_id,
        amount: split.amount,
      })),
    );
    if (remoteSplits.length > 0) {
      transaction
        .insert(expenseSplits)
        .values(remoteSplits)
        .onConflictDoUpdate({
          target: [expenseSplits.expenseId, expenseSplits.memberId],
          set: { amount: sql`excluded.amount` },
        })
        .run();
    }
  });
}

export async function syncGroupSnapshot(userId: string, groupId: string): Promise<string> {
  const db = await getExpenseDatabase();
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
  if (!group || group.syncUserId !== userId) {
    throw new Error('This group is not queued for the current account.');
  }

  const [members, expenseRows] = await Promise.all([
    db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId)),
    db.select().from(groupExpenses).where(eq(groupExpenses.groupId, groupId)),
  ]);
  const groupExpenseIds = new Set(expenseRows.map((expense) => expense.id));
  const splits =
    groupExpenseIds.size > 0
      ? await db
          .select()
          .from(expenseSplits)
          .where(inArray(expenseSplits.expenseId, [...groupExpenseIds]))
      : [];
  let inviteCode = group.inviteCode;

  if (!inviteCode) {
    const { data, error } = await getSupabaseClient().rpc('create_shared_group', {
      p_group_id: group.id,
      p_name: group.name,
      p_created_at: group.createdAt,
      p_members: members.map((member) => ({
        id: member.id,
        name: member.name,
        created_at: member.createdAt,
      })),
    });
    throwRemoteError(error);
    if (!data) throw new Error('The server did not return a group invitation code.');
    inviteCode = data[0]?.invite_code ?? null;
    if (!inviteCode) throw new Error('The server did not return a group invitation code.');
    await db.update(groups).set({ inviteCode }).where(eq(groups.id, groupId));
  }

  const client = getSupabaseClient();
  if (members.length > 0) {
    const { error } = await client.from('group_members').upsert(
      members.map((member) => ({
        id: member.id,
        group_id: groupId,
        name: member.name,
        created_at: member.createdAt,
      })),
      { onConflict: 'id' },
    );
    throwRemoteError(error);
  }

  if (expenseRows.length > 0) {
    const { error } = await client.from('group_expenses').upsert(
      expenseRows.map((expense) => ({
        id: expense.id,
        group_id: expense.groupId,
        description: expense.description,
        amount: expense.amount,
        paid_by_member_id: expense.paidByMemberId,
        date: expense.date,
        kind: expense.kind,
        created_at: expense.createdAt,
      })),
      { onConflict: 'id' },
    );
    throwRemoteError(error);
  }

  if (splits.length > 0) {
    const { error } = await client.from('expense_splits').upsert(
      splits.map((split) => ({
        expense_id: split.expenseId,
        member_id: split.memberId,
        amount: split.amount,
      })),
      { onConflict: 'expense_id,member_id' },
    );
    throwRemoteError(error);
  }

  return inviteCode;
}

export async function joinGroupByInvite(inviteCode: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('join_group_by_invite', {
    p_invite_code: inviteCode,
  });
  throwRemoteError(error);
  if (!data) throw new Error('The server did not return a group for this invitation.');
  return data;
}
