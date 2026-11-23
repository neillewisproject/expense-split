import { desc, eq, inArray } from 'drizzle-orm';

import { getExpenseDatabase, type ExpenseDatabase } from '@/features/expenses/data/database';
import type { GroupLedger, GroupWithDetails } from '../domain/group';
import { expenseSplits, groupActivity, groupExpenses, groupMembers, groups } from './schema';

type Transaction = Parameters<Parameters<ExpenseDatabase['transaction']>[0]>[0];
export type ReceiptMaps = Record<string, Record<string, string[]>>;

export function normalizeReceiptMap(
  value: Record<string, string[]> | string[],
  account: string,
): Record<string, string[]> {
  return Array.isArray(value) ? { [account]: value } : value;
}

export function writeLedger(
  transaction: Transaction,
  group: GroupWithDetails,
  savedReceipts?: ReceiptMaps,
): void {
  const { members, expenses, activity, ...row } = group;
  transaction.insert(groups).values(row).onConflictDoUpdate({ target: groups.id, set: row }).run();
  for (const member of members) {
    transaction
      .insert(groupMembers)
      .values(member)
      .onConflictDoUpdate({ target: groupMembers.id, set: member })
      .run();
  }
  for (const expense of expenses) {
    const { paidBy, split, ...fields } = expense;
    const account = group.syncUserId ?? 'local';
    const existingReceipts =
      savedReceipts?.[expense.id] ??
      normalizeReceiptMap(
        transaction
          .select({ receipts: groupExpenses.receipts })
          .from(groupExpenses)
          .where(eq(groupExpenses.id, expense.id))
          .get()?.receipts ?? {},
        account,
      );
    const expenseRow = {
      ...fields,
      receipts: { ...existingReceipts, [account]: expense.receipts },
      groupId: group.id,
      paidByMemberId: paidBy,
    };
    transaction
      .insert(groupExpenses)
      .values(expenseRow)
      .onConflictDoUpdate({ target: groupExpenses.id, set: expenseRow })
      .run();
    transaction.delete(expenseSplits).where(eq(expenseSplits.expenseId, expense.id)).run();
    const splits = Object.entries(split).map(([memberId, amount]) => ({
      expenseId: expense.id,
      memberId,
      amount,
    }));
    if (splits.length) transaction.insert(expenseSplits).values(splits).run();
  }
  for (const entry of activity) {
    transaction.insert(groupActivity).values(entry).onConflictDoNothing().run();
  }
}

export function toLedger(group: GroupWithDetails): GroupLedger {
  const {
    syncUserId,
    syncStatus,
    inviteCode,
    inviteExpiresAt,
    localRevision,
    meMemberId,
    conflictMessage,
    ...ledger
  } = group;
  void syncUserId;
  void syncStatus;
  void inviteCode;
  void inviteExpiresAt;
  void localRevision;
  void meMemberId;
  void conflictMessage;
  return {
    ...ledger,
    expenses: ledger.expenses.map(({ receipts, ...expense }) => {
      void receipts;
      return expense;
    }),
  };
}

export async function readGroups(userId?: string): Promise<GroupWithDetails[]> {
  const db = await getExpenseDatabase();
  const rows = await db.select().from(groups).orderBy(desc(groups.createdAt));
  const visible = rows.filter((group) => !group.syncUserId || group.syncUserId === userId);
  if (!visible.length) return [];
  const ids = visible.map((group) => group.id);
  const [members, expenses, activity] = await Promise.all([
    db.select().from(groupMembers).where(inArray(groupMembers.groupId, ids)),
    db
      .select()
      .from(groupExpenses)
      .where(inArray(groupExpenses.groupId, ids))
      .orderBy(desc(groupExpenses.date), desc(groupExpenses.createdAt)),
    db
      .select()
      .from(groupActivity)
      .where(inArray(groupActivity.groupId, ids))
      .orderBy(desc(groupActivity.createdAt)),
  ]);
  const expenseIds = expenses.map((expense) => expense.id);
  const splits = expenseIds.length
    ? await db.select().from(expenseSplits).where(inArray(expenseSplits.expenseId, expenseIds))
    : [];
  return visible.map((group) => ({
    ...group,
    meMemberId: group.syncUserId
      ? (members.find((member) => member.groupId === group.id && member.userId === userId)?.id ??
        null)
      : group.meMemberId,
    members: members.filter((member) => member.groupId === group.id),
    expenses: expenses
      .filter((expense) => expense.groupId === group.id)
      .map((expense) => {
        const { groupId, paidByMemberId, ...fields } = expense;
        void groupId;
        return {
          ...fields,
          receipts:
            normalizeReceiptMap(fields.receipts, group.syncUserId ?? 'local')[
              group.syncUserId ?? 'local'
            ] ?? [],
          paidBy: paidByMemberId,
          split: Object.fromEntries(
            splits
              .filter((split) => split.expenseId === expense.id)
              .map((split) => [split.memberId, split.amount]),
          ),
          contributions: expense.contributions ?? { [paidByMemberId]: expense.amount },
          updatedAt: expense.updatedAt || expense.createdAt,
        };
      }),
    activity: activity.filter((entry) => entry.groupId === group.id),
  }));
}
