import type { StoredExpense } from '../data/schema';
import { getCategorySpending } from './category-spending';

const expense: StoredExpense = {
  id: 'expense-1',
  description: 'Lunch',
  amount: 12550,
  category: 'food',
  date: '2026-03-15',
  receiptUri: null,
  createdAt: '2026-03-15T12:00:00.000Z',
  updatedAt: '2026-03-15T12:00:00.000Z',
};

describe('getCategorySpending', () => {
  it('totals the requested month by category and orders highest spending first', () => {
    const result = getCategorySpending(
      [
        expense,
        { ...expense, id: 'expense-2', amount: 500, category: 'food' },
        { ...expense, id: 'expense-3', amount: 800, category: 'transport' },
        { ...expense, id: 'expense-4', date: '2026-02-15', amount: 90000 },
      ],
      '2026-03',
    );

    expect(result).toEqual([
      { category: 'food', amount: 13050 },
      { category: 'transport', amount: 800 },
    ]);
  });

  it('returns no categories when the month has no expenses', () => {
    expect(getCategorySpending([expense], '2026-02')).toEqual([]);
  });
  it('keeps refund credits signed and excludes income, transfers, trash and other currencies', () => {
    expect(
      getCategorySpending(
        [
          { ...expense, id: 'refund', entryType: 'refund', amount: 500, refundOfId: 'old' },
          { ...expense, id: 'income', entryType: 'income' },
          { ...expense, id: 'transfer', entryType: 'transfer' },
          { ...expense, id: 'trash', deletedAt: expense.createdAt },
          { ...expense, id: 'usd', currency: 'USD' },
        ],
        '2026-03',
      ),
    ).toEqual([{ category: 'food', amount: -500 }]);
  });
});
