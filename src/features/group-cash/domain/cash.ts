import type { Account } from '@/features/accounts/data/schema';
import type { StoredExpense } from '@/features/expenses/data/schema';
import type { GroupCashMovement } from '../data/schema';
import type { GroupExpense, GroupWithDetails } from '@/features/groups/domain/group';
import { computeBalances } from '@/features/expenses/domain/balances';

export function groupCashOption(
  group: GroupWithDetails,
  expense: GroupExpense,
  userId: string | null,
) {
  if (group.syncUserId && group.syncUserId !== userId)
    throw new Error('This group belongs to a different signed-in account');
  if (group.syncStatus === 'conflict') throw new Error('Resolve the group conflict first');
  if (expense.deletedAt) throw new Error('Restore the group entry before linking cash');
  computeBalances([expense]);
  const claimed = group.syncUserId
    ? group.members.filter((member) => member.userId === userId)
    : group.members.filter((member) => member.id === group.meMemberId);
  if (claimed.length !== 1)
    throw new Error('Select or claim exactly one participant as yourself before linking cash');
  const memberId = claimed[0]!.id;
  const paid = expense.contributions[memberId] ?? 0;
  const received = expense.kind === 'settlement' ? (expense.split[memberId] ?? 0) : 0;
  const amount = paid || received;
  if (!Number.isSafeInteger(amount) || amount <= 0 || (paid && received))
    throw new Error('This entry does not contain one of your cash payments or receipts');
  if (expense.currency !== group.currency) throw new Error('Group currency does not match');
  return {
    groupId: group.id,
    expenseId: expense.id,
    memberId,
    groupUserId: group.syncUserId,
    currency: group.currency,
    amount,
    direction: expense.kind === 'refund' || received ? ('in' as const) : ('out' as const),
    date: expense.date,
    description: expense.description,
    groupName: group.name,
    expenseRevision: expense.revision,
  };
}

export function validateCashMovement(
  input: ReturnType<typeof groupCashOption>,
  account: Account | undefined,
  existing: GroupCashMovement[],
) {
  if (!account || account.archived || account.currency !== input.currency)
    throw new Error('Choose an active account in the group base currency');
  if (
    existing.some(
      (row) =>
        !row.voidedAt &&
        row.groupId === input.groupId &&
        row.expenseId === input.expenseId &&
        row.memberId === input.memberId &&
        row.direction === input.direction,
    )
  )
    throw new Error('This group cash movement is already linked to an account');
}

type CashMatch = Pick<GroupCashMovement, 'accountId' | 'currency' | 'amount' | 'direction'>;

export function matchesCashTransaction(movement: CashMatch, entry: StoredExpense): boolean {
  const type = entry.entryType ?? 'expense';
  return (
    !entry.deletedAt &&
    entry.accountId === movement.accountId &&
    (entry.currency ?? 'INR') === movement.currency &&
    entry.amount === movement.amount &&
    (movement.direction === 'out' ? type === 'expense' : type === 'income' || type === 'refund')
  );
}

export function validateCashMatch(
  movement: CashMatch,
  entry: StoredExpense | undefined,
  existing: GroupCashMovement[],
) {
  if (!entry || !matchesCashTransaction(movement, entry))
    throw new Error(
      'Choose an active transaction with the same account, currency, amount and direction',
    );
  if (existing.some((row) => !row.voidedAt && row.personalEntryId === entry.id))
    throw new Error('This personal transaction is already matched to a group cash movement');
}

export function validateMatchedTransaction(entry: StoredExpense, movements: GroupCashMovement[]) {
  if (
    movements.some(
      (row) =>
        !row.voidedAt && row.personalEntryId === entry.id && !matchesCashTransaction(row, entry),
    )
  )
    throw new Error('Void the group cash match before changing or deleting this transaction');
}

export function accountGroupCash(
  account: Account,
  rows: GroupCashMovement[],
  entries: StoredExpense[],
): number[] {
  const matched = new Set<string>();
  return rows
    .filter((row) => row.accountId === account.id && !row.voidedAt)
    .map((row) => {
      if (
        row.currency !== account.currency ||
        !Number.isSafeInteger(row.amount) ||
        row.amount <= 0 ||
        (row.direction !== 'in' && row.direction !== 'out')
      )
        throw new Error('An account has an invalid group cash movement');
      if (row.personalEntryId) {
        const entry = entries.find((item) => item.id === row.personalEntryId);
        if (!entry || !matchesCashTransaction(row, entry) || matched.has(row.personalEntryId))
          throw new Error('An account has an invalid or duplicate group cash match');
        matched.add(row.personalEntryId);
        return 0;
      }
      return row.direction === 'in' ? row.amount : -row.amount;
    });
}
