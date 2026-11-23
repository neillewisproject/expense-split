import type { Account } from '@/features/accounts/data/schema';
import type { StoredExpense } from '../data/schema';
import { accountBalance, filterEntries, safeSum, validateEntry } from './ledger';

const account: Account = {
  id: 'cash',
  name: 'Cash',
  currency: 'INR',
  openingBalance: 10000,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const expense: StoredExpense = {
  id: 'lunch',
  description: 'Lunch',
  amount: 2000,
  category: 'food',
  date: '2026-03-01',
  receiptUri: null,
  accountId: 'cash',
  createdAt: account.createdAt,
  updatedAt: account.createdAt,
};

describe('personal ledger', () => {
  it('keeps income, expense, refund and transfers correct without mixing currencies or deleted rows', () => {
    const other = { ...account, id: 'bank', openingBalance: 0 };
    const entries: StoredExpense[] = [
      expense,
      { ...expense, id: 'pay', entryType: 'income', amount: 5000 },
      { ...expense, id: 'refund', entryType: 'refund', refundOfId: 'lunch', amount: 500 },
      { ...expense, id: 'move', entryType: 'transfer', toAccountId: 'bank', amount: 1000 },
      { ...expense, id: 'trash', amount: 9999, deletedAt: account.createdAt },
      { ...expense, id: 'usd', currency: 'USD', amount: 9999 },
    ];
    expect(accountBalance(account, entries)).toBe(12500);
    expect(accountBalance(other, entries)).toBe(1000);
  });
  it('rejects cross-currency and same-account transfers', () => {
    expect(() =>
      validateEntry({ ...expense, entryType: 'transfer', toAccountId: 'cash' }, [account], []),
    ).toThrow('two different');
    expect(() =>
      validateEntry(
        { ...expense, entryType: 'transfer', toAccountId: 'usd' },
        [account, { ...account, id: 'usd', currency: 'USD' }],
        [],
      ),
    ).toThrow('currencies must match');
  });
  it('caps linked refunds and protects their original amount and category when edited', () => {
    const refund: StoredExpense = {
      ...expense,
      id: 'refund',
      entryType: 'refund',
      refundOfId: 'lunch',
      amount: 500,
    };
    expect(() => validateEntry({ ...refund, amount: 1600 }, [account], [expense, refund])).toThrow(
      'exceed',
    );
    expect(() =>
      validateEntry({ ...expense, amount: 400 }, [account], [expense, refund], expense.id),
    ).toThrow('invalidate');
    expect(() =>
      validateEntry(
        { ...expense, category: 'transport' },
        [account],
        [expense, refund],
        expense.id,
      ),
    ).toThrow('invalidate');
    expect(() => validateEntry(refund, [account], [expense, refund], refund.id)).not.toThrow();
  });
  it('filters notes, exact tags, account destination, receipt, trash and currency', () => {
    const row = {
      ...expense,
      notes: 'birthday',
      tags: '["gift"]',
      entryType: 'transfer' as const,
      toAccountId: 'bank',
      receiptUri: 'file:receipt',
    };
    expect(
      filterEntries([row, { ...row, id: 'trash', deletedAt: account.createdAt }], {
        search: 'BIRTHDAY',
        tag: 'gift',
        accountId: 'bank',
        receipt: 'yes',
        currency: 'INR',
      }),
    ).toEqual([row]);
    expect(filterEntries([row], { tag: 'gif' })).toEqual([]);
  });
  it('reports aggregate overflow rather than rounding silently', () => {
    expect(() => safeSum([Number.MAX_SAFE_INTEGER, 1])).toThrow('too large');
  });
});
