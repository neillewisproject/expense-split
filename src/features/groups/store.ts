import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import { getExpenseDatabase } from '@/features/expenses/data/database';
import {
  expenseSplits,
  groupExpenses,
  groupMembers,
  groups,
  type StoredExpenseSplit,
  type StoredGroup,
  type StoredGroupExpense,
  type StoredGroupMember,
} from './data/schema';
import type { GroupExpense, GroupExpenseKind, GroupWithDetails } from './domain/group';

type GroupsStatus = 'idle' | 'loading' | 'ready' | 'error';

type GroupExpenseInput = {
  description: string;
  amount: number;
  paidBy: string;
  split: Record<string, number>;
  date: string;
  kind: GroupExpenseKind;
};

type GroupsState = {
  groups: GroupWithDetails[];
  status: GroupsStatus;
  error: string | null;
  syncError: string | null;
  syncRetry: number;
  activeUserId: string | null;
  loadGroups: (userId?: string) => Promise<void>;
  createGroup: (name: string, memberNames: string[], syncUserId?: string) => Promise<string>;
  addGroupExpense: (groupId: string, input: GroupExpenseInput) => Promise<void>;
  markGroupSynced: (groupId: string, inviteCode: string) => Promise<void>;
  setSyncError: (message: string | null) => void;
  retryPendingSync: () => void;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected local database error.';
}

function groupRows(
  groupRows: StoredGroup[],
  members: StoredGroupMember[],
  groupExpenseRows: StoredGroupExpense[],
  splits: StoredExpenseSplit[],
): GroupWithDetails[] {
  const membersByGroup = new Map<string, StoredGroupMember[]>();
  const splitsByExpense = new Map<string, StoredExpenseSplit[]>();
  const expensesByGroup = new Map<string, StoredGroupExpense[]>();

  for (const member of members) {
    const items = membersByGroup.get(member.groupId) ?? [];
    items.push(member);
    membersByGroup.set(member.groupId, items);
  }

  for (const split of splits) {
    const items = splitsByExpense.get(split.expenseId) ?? [];
    items.push(split);
    splitsByExpense.set(split.expenseId, items);
  }

  for (const expense of groupExpenseRows) {
    const items = expensesByGroup.get(expense.groupId) ?? [];
    items.push(expense);
    expensesByGroup.set(expense.groupId, items);
  }

  return groupRows.map((group) => ({
    ...group,
    members: membersByGroup.get(group.id) ?? [],
    syncUserId: group.syncUserId,
    syncStatus: group.syncStatus,
    inviteCode: group.inviteCode,
    expenses: (expensesByGroup.get(group.id) ?? []).map((expense): GroupExpense => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      paidBy: expense.paidByMemberId,
      split: Object.fromEntries(
        (splitsByExpense.get(expense.id) ?? []).map((item) => [item.memberId, item.amount]),
      ),
      createdAt: expense.createdAt,
      date: expense.date,
      kind: expense.kind,
    })),
  }));
}

async function readGroups(userId?: string): Promise<GroupWithDetails[]> {
  const db = await getExpenseDatabase();
  const [storedGroups, members, storedExpenses, splits] = await Promise.all([
    db.select().from(groups).orderBy(desc(groups.createdAt)),
    db.select().from(groupMembers),
    db
      .select()
      .from(groupExpenses)
      .orderBy(desc(groupExpenses.date), desc(groupExpenses.createdAt)),
    db.select().from(expenseSplits),
  ]);
  return groupRows(storedGroups, members, storedExpenses, splits).filter(
    (group) => group.syncUserId === null || group.syncUserId === userId,
  );
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  status: 'idle',
  error: null,
  syncError: null,
  syncRetry: 0,
  activeUserId: null,

  loadGroups: async (userId) => {
    const nextUserId = userId ?? null;
    set((state) => ({
      status: 'loading',
      error: null,
      groups: state.activeUserId === nextUserId ? state.groups : [],
    }));
    try {
      set({
        groups: await readGroups(userId),
        status: 'ready',
        error: null,
        activeUserId: userId ?? null,
      });
    } catch (error) {
      set({ status: 'error', error: `Could not load groups: ${getErrorMessage(error)}` });
    }
  },

  createGroup: async (name, memberNames, syncUserId) => {
    const cleanName = name.trim();
    const cleanMembers = memberNames.map((member) => member.trim()).filter(Boolean);
    const uniqueNames = new Set(cleanMembers.map((member) => member.toLowerCase()));
    if (!cleanName) throw new Error('Enter a group name.');
    if (cleanMembers.length < 2) throw new Error('Add your name and at least one other member.');
    if (uniqueNames.size !== cleanMembers.length) throw new Error('Member names must be unique.');

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const memberRows = cleanMembers.map((memberName) => ({
      id: randomUUID(),
      groupId: id,
      name: memberName,
      createdAt,
    }));

    try {
      const db = await getExpenseDatabase();
      db.transaction((transaction) => {
        transaction
          .insert(groups)
          .values({
            id,
            name: cleanName,
            createdAt,
            syncUserId: syncUserId ?? null,
            syncStatus: syncUserId ? 'pending' : 'local',
            inviteCode: null,
          })
          .run();
        transaction.insert(groupMembers).values(memberRows).run();
      });
      set({
        groups: await readGroups(syncUserId),
        status: 'ready',
        error: null,
        activeUserId: syncUserId ?? null,
      });
      return id;
    } catch (error) {
      const message = `Could not create group: ${getErrorMessage(error)}`;
      set({ error: message });
      throw new Error(message, { cause: error });
    }
  },

  addGroupExpense: async (groupId, input) => {
    const group = get().groups.find((item) => item.id === groupId);
    const memberIds = new Set(group?.members.map((member) => member.id) ?? []);
    const allSplits = Object.entries(input.split);
    const splitEntries = allSplits.filter(([, amount]) => amount > 0);
    const splitTotal = splitEntries.reduce((total, [, amount]) => total + amount, 0);

    if (!group) throw new Error('Group not found. Reload and try again.');
    if (!memberIds.has(input.paidBy)) throw new Error('Choose a member who paid.');
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
      throw new Error('Expense amount must be positive.');
    }
    if (
      splitEntries.length === 0 ||
      allSplits.some(
        ([memberId, amount]) =>
          !memberIds.has(memberId) || !Number.isSafeInteger(amount) || amount < 0,
      ) ||
      splitTotal !== input.amount
    ) {
      throw new Error('The split must assign the full amount to group members.');
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    try {
      const db = await getExpenseDatabase();
      db.transaction((transaction) => {
        transaction
          .insert(groupExpenses)
          .values({
            id,
            groupId,
            description: input.description.trim(),
            amount: input.amount,
            paidByMemberId: input.paidBy,
            date: input.date,
            kind: input.kind,
            createdAt,
          })
          .run();
        transaction
          .insert(expenseSplits)
          .values(splitEntries.map(([memberId, amount]) => ({ expenseId: id, memberId, amount })))
          .run();
        if (group.syncUserId) {
          transaction
            .update(groups)
            .set({ syncStatus: 'pending' })
            .where(eq(groups.id, groupId))
            .run();
        }
      });
      set({
        groups: await readGroups(get().activeUserId ?? undefined),
        status: 'ready',
        error: null,
      });
    } catch (error) {
      const message = `Could not save group expense: ${getErrorMessage(error)}`;
      set({ error: message });
      throw new Error(message, { cause: error });
    }
  },

  markGroupSynced: async (groupId, inviteCode) => {
    const userId = get().activeUserId;
    const db = await getExpenseDatabase();
    await db.update(groups).set({ syncStatus: 'synced', inviteCode }).where(eq(groups.id, groupId));
    set({
      groups: await readGroups(userId ?? undefined),
      syncError: null,
    });
  },

  setSyncError: (syncError) => set({ syncError }),

  retryPendingSync: () => set((state) => ({ syncRetry: state.syncRetry + 1 })),
}));
