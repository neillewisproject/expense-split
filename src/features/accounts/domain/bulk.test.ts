import type { StoredExpense } from '@/features/expenses/data/schema';
import { prepareBulkChange } from './bulk';

const now = '2026-03-01T00:00:00.000Z';
const expense: StoredExpense = {
  id: 'meal',
  description: 'Meal',
  amount: 1000,
  category: 'food',
  date: '2026-03-01',
  receiptUri: null,
  tags: '["old"]',
  createdAt: now,
  updatedAt: now,
};
const refund: StoredExpense = {
  ...expense,
  id: 'refund',
  entryType: 'refund',
  refundOfId: 'meal',
  amount: 300,
};
it('only prepares explicitly selected rows and adds tags without deleting or duplicating existing tags', () => {
  const other = { ...expense, id: 'other' };
  const result = prepareBulkChange(
    [expense, other],
    [expense.id],
    { type: 'tags', tags: 'old, new, new' },
    [],
    now,
  );
  expect(result).toEqual([{ ...expense, tags: '["old","new"]' }]);
  expect(other.tags).toBe('["old"]');
  expect(expense.tags).toBe('["old"]');
});
it('requires the original and active linked refunds to be recategorized or trashed consistently', () => {
  expect(() =>
    prepareBulkChange(
      [expense, refund],
      ['meal'],
      { type: 'category', category: 'transport' },
      [],
      now,
    ),
  ).toThrow('invalidate');
  expect(
    prepareBulkChange(
      [expense, refund],
      ['meal', 'refund'],
      { type: 'category', category: 'transport' },
      [],
      now,
    ).every((row) => row.category === 'transport'),
  ).toBe(true);
  expect(() => prepareBulkChange([expense, refund], ['meal'], { type: 'trash' }, [], now)).toThrow(
    'linked refunds',
  );
  expect(
    prepareBulkChange([expense, refund], ['meal', 'refund'], { type: 'trash' }, [], now).every(
      (row) => row.deletedAt === now,
    ),
  ).toBe(true);
});
it('rejects empty, duplicate, missing, trashed and invalid selections before writes', () => {
  expect(() => prepareBulkChange([expense], [], { type: 'trash' }, [], now)).toThrow('Select');
  expect(() => prepareBulkChange([expense], ['meal', 'meal'], { type: 'trash' }, [], now)).toThrow(
    'distinct',
  );
  expect(() => prepareBulkChange([expense], ['missing'], { type: 'trash' }, [], now)).toThrow(
    'missing',
  );
  expect(() =>
    prepareBulkChange([{ ...expense, deletedAt: now }], ['meal'], { type: 'trash' }, [], now),
  ).toThrow('trash');
  expect(() =>
    prepareBulkChange([expense], ['meal'], { type: 'tags', tags: 'x'.repeat(41) }, [], now),
  ).toThrow('short labels');
});
