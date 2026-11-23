import { eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import { getExpenseDatabase } from '@/features/expenses/data/database';
import { getCurrencyExponent } from '@/features/expenses/domain/money';
import { groupOperations, groups } from './data/schema';
import { readGroups, toLedger, writeLedger } from './data/local-ledger';
import { withGroupLock } from './data/group-lock';
import type { GroupExpense, GroupExpenseKind, GroupWithDetails, SplitInputs } from './domain/group';
import { canEditExpense, canManageGroup, validateGroupExpense } from './domain/validation';
import { calculateGroupRefund, validateGroupRefunds } from './domain/refunds';

export type GroupExpenseInput = {
  description: string;
  amount: number;
  paidBy: string;
  split: Record<string, number>;
  date: string;
  kind: GroupExpenseKind;
  contributions?: Record<string, number>;
  splitInputs?: SplitInputs | null;
  category?: string;
  notes?: string;
  method?: string;
  reference?: string;
  itemized?: GroupExpense['itemized'];
  receipts?: string[];
  conversion?: GroupExpense['conversion'];
  refundOfId?: string | null;
  refundSnapshot?: GroupExpense['refundSnapshot'];
};

type GroupsState = {
  groups: GroupWithDetails[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  syncError: string | null;
  syncRetry: number;
  activeUserId: string | null;
  loadGroups: (userId?: string) => Promise<void>;
  createGroup: (
    name: string,
    memberNames: string[],
    syncUserId?: string,
    currency?: string,
    localMeIndex?: number,
  ) => Promise<string>;
  addGroupExpense: (
    groupId: string,
    input: GroupExpenseInput,
    idempotencyId?: string,
  ) => Promise<void>;
  editGroupExpense: (groupId: string, expenseId: string, input: GroupExpenseInput) => Promise<void>;
  setExpenseDeleted: (groupId: string, expenseId: string, deleted: boolean) => Promise<void>;
  recordGroupRefund: (
    groupId: string,
    originalId: string,
    input: {
      sourceAmount: number;
      date: string;
      notes: string;
      description?: string;
    },
    refundId?: string,
    idempotencyId?: string,
  ) => Promise<void>;
  updateGroup: (groupId: string, changes: { name?: string; archived?: boolean }) => Promise<void>;
  addMember: (groupId: string, name: string) => Promise<void>;
  updateMember: (
    groupId: string,
    memberId: string,
    changes: { name?: string; active?: boolean; userId?: string | null },
  ) => Promise<void>;
  setMe: (groupId: string, memberId: string | null) => Promise<void>;
  addComment: (groupId: string, expenseId: string, text: string) => Promise<void>;
  markGroupSynced: (groupId: string, inviteCode: string) => Promise<void>;
  setSyncError: (message: string | null) => void;
  retryPendingSync: () => void;
};
let loadSequence = 0;

function validateName(name: string): string {
  const clean = name.trim();
  if (!clean || clean.length > 80) throw new Error('Names must contain 1–80 characters.');
  return clean;
}

async function mutateGroup(
  groupId: string,
  action: string,
  change: (group: GroupWithDetails, userId: string | null) => void | false,
  expenseId: string | null = null,
  text = '',
): Promise<void> {
  const userId = useGroupsStore.getState().activeUserId;
  await withGroupLock(groupId, async () => {
    const db = await getExpenseDatabase();
    const group = (await readGroups(userId ?? undefined)).find((item) => item.id === groupId);
    if (!group) throw new Error('Group not found for this account.');
    if (group.syncStatus === 'conflict')
      throw new Error('Resolve the cloud conflict before editing.');
    if (group.archivedAt && action !== 'group_updated')
      throw new Error('Reopen this group before editing.');
    const before = toLedger(group);
    const beforeExpense = before.expenses.find((expense) => expense.id === expenseId) ?? null;
    const beforeGroup = {
      name: group.name,
      archivedAt: group.archivedAt,
      members: group.members.map((member) => ({ ...member })),
    };
    if (change(group, userId) === false) return;
    validateGroupRefunds(group, before);
    group.localRevision++;
    group.activity.push({
      id: randomUUID(),
      groupId,
      expenseId,
      actorId: group.syncUserId ? userId : null,
      action,
      text,
      details:
        action === 'comment'
          ? ''
          : JSON.stringify({
              before: expenseId ? beforeExpense : beforeGroup,
              after: expenseId
                ? (toLedger(group).expenses.find((expense) => expense.id === expenseId) ?? null)
                : { name: group.name, archivedAt: group.archivedAt, members: group.members },
            }),
      createdAt: new Date().toISOString(),
    });
    const queued = await db
      .select()
      .from(groupOperations)
      .where(eq(groupOperations.groupId, groupId));
    if (group.syncUserId) group.syncStatus = 'pending';
    db.transaction((tx) => {
      writeLedger(tx, group);
      if (group.syncUserId) {
        tx.insert(groupOperations)
          .values({
            id: randomUUID(),
            groupId,
            userId: group.syncUserId,
            localRevision: group.localRevision,
            baseRevision: group.revision + queued.length,
            snapshot: toLedger(group),
            createdAt: new Date().toISOString(),
          })
          .run();
      }
    });
  });
  const state = useGroupsStore.getState();
  if (state.activeUserId === userId) await state.loadGroups(userId ?? undefined);
}

function expenseFromInput(
  group: GroupWithDetails,
  input: GroupExpenseInput,
  id: string,
  userId: string | null,
  existing?: GroupExpense,
): GroupExpense {
  const now = new Date().toISOString();
  const result: GroupExpense = {
    id,
    description: input.description.trim(),
    amount: input.amount,
    paidBy: input.paidBy,
    split: input.split,
    date: input.date,
    kind: input.kind,
    currency: group.currency,
    contributions: input.contributions ?? { [input.paidBy]: input.amount },
    splitInputs: input.splitInputs ?? null,
    category: input.category?.trim() || 'other',
    notes: input.notes?.trim() ?? '',
    method: input.method?.trim() ?? '',
    reference: input.reference?.trim() ?? '',
    authorId: existing?.authorId ?? (group.syncUserId ? userId : null),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    revision: (existing?.revision ?? 0) + 1,
    deletedAt: existing?.deletedAt ?? null,
    itemized: input.itemized ?? null,
    receipts: input.receipts ?? existing?.receipts ?? [],
    conversion: input.conversion ?? null,
    refundOfId: input.refundOfId ?? null,
    refundSnapshot: input.refundSnapshot ?? null,
  };
  // Legacy authorless entries must stay authorless even when corrected by their owner.
  if (existing) result.authorId = existing.authorId;
  validateGroupExpense(group, result);
  return result;
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  status: 'idle',
  error: null,
  syncError: null,
  syncRetry: 0,
  activeUserId: null,
  loadGroups: async (userId) => {
    const sequence = ++loadSequence;
    const account = userId ?? null;
    set((state) => ({
      status: 'loading',
      error: null,
      activeUserId: account,
      groups: state.activeUserId === account ? state.groups : [],
    }));
    try {
      const result = await readGroups(userId);
      if (get().activeUserId === account && sequence === loadSequence)
        set({ groups: result, status: 'ready', error: null });
    } catch (error) {
      console.error('Could not load groups', error);
      if (get().activeUserId === account && sequence === loadSequence)
        set({ status: 'error', error: 'Could not load local groups. Try again.' });
    }
  },
  createGroup: async (name, memberNames, syncUserId, currency = 'INR', localMeIndex) => {
    const cleanName = validateName(name);
    const cleanMembers = memberNames
      .map((member) => member.trim())
      .filter(Boolean)
      .map(validateName);
    if (cleanMembers.length < 2) throw new Error('Add at least two participants.');
    if (new Set(cleanMembers.map((member) => member.toLowerCase())).size !== cleanMembers.length) {
      throw new Error('Participant names must be unique.');
    }
    getCurrencyExponent(currency);
    if (
      localMeIndex !== undefined &&
      (syncUserId ||
        !Number.isInteger(localMeIndex) ||
        localMeIndex < 0 ||
        localMeIndex >= cleanMembers.length)
    )
      throw new Error('Choose an explicit local participant for the me mapping.');
    const id = randomUUID();
    const now = new Date().toISOString();
    const group: GroupWithDetails = {
      id,
      name: cleanName,
      currency,
      createdAt: now,
      ownerId: syncUserId ?? null,
      revision: 0,
      localRevision: 1,
      archivedAt: null,
      syncUserId: syncUserId ?? null,
      syncStatus: syncUserId ? 'pending' : 'local',
      inviteCode: null,
      meMemberId: null,
      conflictMessage: null,
      members: cleanMembers.map((memberName) => ({
        id: randomUUID(),
        groupId: id,
        name: memberName,
        createdAt: now,
        deactivatedAt: null,
        userId: null,
      })),
      expenses: [],
      activity: [
        {
          id: randomUUID(),
          groupId: id,
          expenseId: null,
          actorId: syncUserId ?? null,
          action: 'group_created',
          text: '',
          details: '',
          createdAt: now,
        },
      ],
    };
    if (localMeIndex !== undefined) group.meMemberId = group.members[localMeIndex]!.id;
    const db = await getExpenseDatabase();
    db.transaction((tx) => {
      writeLedger(tx, group);
      if (syncUserId)
        tx.insert(groupOperations)
          .values({
            id: randomUUID(),
            groupId: id,
            userId: syncUserId,
            baseRevision: 0,
            localRevision: 1,
            snapshot: toLedger(group),
            createdAt: now,
          })
          .run();
    });
    await get().loadGroups(get().activeUserId ?? undefined);
    return id;
  },
  addGroupExpense: async (groupId, input, idempotencyId) => {
    if (input.kind === 'refund')
      throw new Error('Use the linked refund form to preserve the original allocations.');
    const id = idempotencyId ?? randomUUID();
    if (
      get()
        .groups.find((group) => group.id === groupId)
        ?.expenses.some((expense) => expense.id === id)
    )
      return;
    await mutateGroup(
      groupId,
      'expense_added',
      (group, userId) => {
        if (group.expenses.some((expense) => expense.id === id))
          throw new Error('This entry was already recorded.');
        group.expenses.push(expenseFromInput(group, input, id, userId));
      },
      id,
    );
  },
  editGroupExpense: async (groupId, expenseId, input) => {
    await mutateGroup(
      groupId,
      'expense_edited',
      (group, userId) => {
        const index = group.expenses.findIndex((expense) => expense.id === expenseId);
        const existing = group.expenses[index];
        if (existing?.kind === 'refund')
          throw new Error('Use the linked refund form to edit this refund.');
        if (!existing || !canEditExpense(group, existing, userId))
          throw new Error('Only the author or group owner can edit this entry.');
        group.expenses[index] = expenseFromInput(group, input, expenseId, userId, existing);
      },
      expenseId,
    );
  },
  setExpenseDeleted: async (groupId, expenseId, deleted) => {
    await mutateGroup(
      groupId,
      deleted ? 'expense_deleted' : 'expense_restored',
      (group, userId) => {
        const expense = group.expenses.find((item) => item.id === expenseId);
        if (!expense || !canEditExpense(group, expense, userId))
          throw new Error('Only the author or owner can change this entry.');
        expense.deletedAt = deleted ? new Date().toISOString() : null;
        expense.updatedAt = new Date().toISOString();
        expense.revision++;
      },
      expenseId,
    );
  },
  recordGroupRefund: async (groupId, originalId, input, refundId, idempotencyId) => {
    const id = refundId ?? idempotencyId ?? randomUUID();
    await mutateGroup(
      groupId,
      refundId ? 'refund_edited' : 'refund_added',
      (group, userId) => {
        const duplicate = !refundId ? group.expenses.find((entry) => entry.id === id) : undefined;
        if (duplicate) {
          if (
            duplicate.kind !== 'refund' ||
            duplicate.refundOfId !== originalId ||
            duplicate.refundSnapshot?.sourceAmount !== input.sourceAmount ||
            duplicate.date !== input.date ||
            duplicate.notes !== input.notes.trim() ||
            (input.description?.trim() && duplicate.description !== input.description.trim())
          )
            throw new Error(
              'This refund ID is already bound to different input. Open a new refund form for another entry.',
            );
          return false;
        }
        const original = group.expenses.find((entry) => entry.id === originalId);
        const existing = refundId
          ? group.expenses.find((entry) => entry.id === refundId)
          : undefined;
        if (
          !original ||
          (!existing && !canEditExpense(group, original, userId)) ||
          (refundId &&
            (!existing ||
              existing.kind !== 'refund' ||
              existing.refundOfId !== originalId ||
              existing.deletedAt ||
              !canEditExpense(group, existing, userId)))
        ) {
          throw new Error(
            'Only the original author or owner can add a refund; existing refunds remain author/owner-managed.',
          );
        }
        const calculated = calculateGroupRefund(group, originalId, input.sourceAmount, refundId);
        const next = expenseFromInput(
          group,
          {
            ...calculated,
            description:
              input.description?.trim() || `Refund: ${original.description}`.slice(0, 80),
            date: input.date,
            kind: 'refund',
            notes: input.notes,
            category: original.category,
            method: existing?.method,
            reference: existing?.reference,
          },
          id,
          userId,
          existing,
        );
        if (existing) group.expenses[group.expenses.findIndex((entry) => entry.id === id)] = next;
        else {
          if (group.expenses.some((entry) => entry.id === id))
            throw new Error('This refund was already recorded.');
          group.expenses.push(next);
        }
      },
      id,
    );
  },
  updateGroup: async (groupId, changes) => {
    await mutateGroup(groupId, 'group_updated', (group, userId) => {
      if (!canManageGroup(group, userId)) throw new Error('Only the owner can manage this group.');
      if (changes.name !== undefined) group.name = validateName(changes.name);
      if (changes.archived !== undefined)
        group.archivedAt = changes.archived ? new Date().toISOString() : null;
    });
  },
  addMember: async (groupId, name) => {
    await mutateGroup(groupId, 'participant_added', (group, userId) => {
      if (!canManageGroup(group, userId))
        throw new Error('Only the owner can manage participants.');
      const clean = validateName(name);
      if (group.members.some((member) => member.name.toLowerCase() === clean.toLowerCase()))
        throw new Error('Use a unique participant name.');
      group.members.push({
        id: randomUUID(),
        groupId,
        name: clean,
        createdAt: new Date().toISOString(),
        deactivatedAt: null,
        userId: null,
      });
    });
  },
  updateMember: async (groupId, memberId, changes) => {
    await mutateGroup(groupId, 'participant_updated', (group, userId) => {
      if (!canManageGroup(group, userId))
        throw new Error('Only the owner can manage participants and identity claims.');
      const member = group.members.find((item) => item.id === memberId);
      if (!member) throw new Error('Participant not found.');
      if (changes.name !== undefined) {
        const clean = validateName(changes.name);
        if (
          group.members.some(
            (item) => item.id !== memberId && item.name.toLowerCase() === clean.toLowerCase(),
          )
        )
          throw new Error('Use a unique participant name.');
        member.name = clean;
      }
      if (changes.active !== undefined)
        member.deactivatedAt = changes.active ? null : new Date().toISOString();
      if (changes.userId !== undefined) {
        if (!group.syncUserId) throw new Error('Use local “me” mapping for local groups.');
        if (
          changes.userId &&
          group.members.some((item) => item.id !== memberId && item.userId === changes.userId)
        )
          throw new Error('This account is already mapped to another participant.');
        member.userId = changes.userId;
      }
    });
  },
  setMe: async (groupId, memberId) => {
    const userId = get().activeUserId;
    await withGroupLock(groupId, async () => {
      const group = (await readGroups(userId ?? undefined)).find((item) => item.id === groupId);
      if (!group) throw new Error('Group not found.');
      if (group.syncUserId) throw new Error('Shared identities must be approved by the owner.');
      if (memberId && !group.members.some((member) => member.id === memberId))
        throw new Error('Choose a group participant.');
      const db = await getExpenseDatabase();
      await db.update(groups).set({ meMemberId: memberId }).where(eq(groups.id, groupId));
    });
    if (get().activeUserId === userId) await get().loadGroups(userId ?? undefined);
  },
  addComment: async (groupId, expenseId, text) => {
    const clean = text.trim();
    if (!clean || clean.length > 1000) throw new Error('Comments need 1–1000 characters.');
    await mutateGroup(
      groupId,
      'comment',
      (group) => {
        if (!group.expenses.some((expense) => expense.id === expenseId))
          throw new Error('Entry not found.');
      },
      expenseId,
      clean,
    );
  },
  // The uploader acknowledges individual immutable operations itself, never all pending changes.
  markGroupSynced: async () => {
    await get().loadGroups(get().activeUserId ?? undefined);
  },
  setSyncError: (syncError) => set({ syncError }),
  retryPendingSync: () => set((state) => ({ syncRetry: state.syncRetry + 1 })),
}));
