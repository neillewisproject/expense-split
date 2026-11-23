import type { Account } from '@/features/accounts/data/schema';
import type { StoredExpense } from '../data/schema';
import type { ExpenseInput } from './expense';
import { expenseFormSchema, getReceiptUris } from './expense';
import { amountToInput } from './money';
import { accountGroupCash } from '@/features/group-cash/domain/cash';
import type { GroupCashMovement } from '@/features/group-cash/data/schema';

export function safeSum(values: number[]): number {
  const sum = values.reduce((total, value) => total + BigInt(value), 0n);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER) || sum < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('The combined total is too large to represent safely');
  }
  return Number(sum);
}

export function validateEntry(
  input: ExpenseInput,
  accounts: Account[],
  entries: StoredExpense[],
  id?: string,
): void {
  const currency = input.currency ?? 'INR';
  const result = expenseFormSchema.safeParse({
    ...input,
    amount: amountToInput(input.amount, currency),
    accountId: input.accountId ?? '',
    toAccountId: input.toAccountId ?? '',
    refundOfId: input.refundOfId ?? '',
  });
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Invalid transaction');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
    throw new Error('Amount must be positive safe integer minor units');
  getReceiptUris(input);
  try {
    const tags: unknown = JSON.parse(input.tags ?? '[]');
    if (
      !Array.isArray(tags) ||
      tags.length > 30 ||
      tags.some((tag) => typeof tag !== 'string' || tag.length > 40)
    )
      throw new Error();
  } catch {
    throw new Error('Tags must be an array of short labels');
  }
  for (const accountId of [
    input.accountId,
    input.entryType === 'transfer' ? input.toAccountId : null,
  ]) {
    if (!accountId) continue;
    const account = accounts.find((item) => item.id === accountId);
    if (!account || account.archived) throw new Error('Choose an active account');
    if (account.currency !== currency)
      throw new Error(
        'Account and transaction currencies must match; cross-currency transfers are not supported',
      );
  }
  if (input.entryType !== 'transfer' && input.toAccountId)
    throw new Error('Only transfers have a destination account');
  if (input.entryType !== 'refund' && input.refundOfId)
    throw new Error('Only refunds link an original expense');
  const linkedRefunds = entries.filter(
    (item) =>
      item.id !== id && !item.deletedAt && item.entryType === 'refund' && item.refundOfId === id,
  );
  if (
    linkedRefunds.length &&
    ((input.entryType ?? 'expense') !== 'expense' ||
      linkedRefunds.some(
        (item) => (item.currency ?? 'INR') !== currency || item.category !== input.category,
      ) ||
      safeSum(linkedRefunds.map((item) => item.amount)) > input.amount)
  ) {
    throw new Error('This change would invalidate linked refunds');
  }
  if (input.entryType === 'refund') {
    const original = entries.find((item) => item.id === input.refundOfId && !item.deletedAt);
    if (!original || original.id === id || (original.entryType ?? 'expense') !== 'expense')
      throw new Error('Choose a posted expense to refund');
    if ((original.currency ?? 'INR') !== currency || original.category !== input.category)
      throw new Error('Refund currency and category must match the original expense');
    const alreadyRefunded = safeSum(
      entries
        .filter(
          (item) =>
            item.id !== id &&
            !item.deletedAt &&
            item.entryType === 'refund' &&
            item.refundOfId === original.id,
        )
        .map((item) => item.amount),
    );
    if (safeSum([alreadyRefunded, input.amount]) > original.amount)
      throw new Error('Refunds cannot exceed the original expense');
  }
}

export function consumption(entry: StoredExpense): number {
  if (entry.deletedAt) return 0;
  return (entry.entryType ?? 'expense') === 'expense'
    ? entry.amount
    : entry.entryType === 'refund'
      ? -entry.amount
      : 0;
}

export function accountBalance(
  account: Account,
  entries: StoredExpense[],
  groupCash: GroupCashMovement[] = [],
): number {
  return safeSum([
    account.openingBalance,
    ...accountGroupCash(account, groupCash, entries),
    ...entries
      .filter((entry) => !entry.deletedAt && (entry.currency ?? 'INR') === account.currency)
      .flatMap((entry) => {
        const type = entry.entryType ?? 'expense';
        const values: number[] = [];
        if (entry.accountId === account.id)
          values.push(type === 'income' || type === 'refund' ? entry.amount : -entry.amount);
        if (type === 'transfer' && entry.toAccountId === account.id) values.push(entry.amount);
        return values;
      }),
  ]);
}

export type EntryFilter = {
  search?: string;
  month?: string;
  category?: string;
  accountId?: string;
  tag?: string;
  currency?: string;
  entryType?: string;
  trash?: boolean;
  receipt?: 'yes' | 'no';
  minAmount?: number;
  maxAmount?: number;
  sort?: 'newest' | 'oldest' | 'amount';
};
export function filterEntries(entries: StoredExpense[], filter: EntryFilter): StoredExpense[] {
  const query = filter.search?.trim().toLowerCase();
  return entries
    .filter(
      (entry) =>
        Boolean(entry.deletedAt) === Boolean(filter.trash) &&
        (!query ||
          `${entry.description} ${entry.notes ?? ''} ${entry.tags ?? ''}`
            .toLowerCase()
            .includes(query)) &&
        (!filter.month || entry.date.startsWith(filter.month)) &&
        (!filter.category || entry.category === filter.category) &&
        (!filter.accountId ||
          entry.accountId === filter.accountId ||
          entry.toAccountId === filter.accountId) &&
        (!filter.tag || (JSON.parse(entry.tags ?? '[]') as string[]).includes(filter.tag)) &&
        (!filter.currency || (entry.currency ?? 'INR') === filter.currency) &&
        (!filter.entryType || (entry.entryType ?? 'expense') === filter.entryType) &&
        (!filter.receipt || Boolean(entry.receiptUri) === (filter.receipt === 'yes')) &&
        (filter.minAmount === undefined || entry.amount >= filter.minAmount) &&
        (filter.maxAmount === undefined || entry.amount <= filter.maxAmount),
    )
    .sort((a, b) =>
      filter.sort === 'amount'
        ? b.amount - a.amount
        : filter.sort === 'oldest'
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
}
