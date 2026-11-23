import { expenseFormSchema } from './expense';

describe('expenseFormSchema', () => {
  const validExpense = {
    description: 'Lunch',
    amount: '120.50',
    category: 'food',
    date: '2026-03-15',
  };

  it('accepts a complete expense with a valid amount and calendar date', () => {
    expect(expenseFormSchema.safeParse(validExpense).success).toBe(true);
  });

  it.each([
    [{ ...validExpense, description: '  ' }],
    [{ ...validExpense, amount: '0' }],
    [{ ...validExpense, amount: '12.345' }],
    [{ ...validExpense, amount: '99999999999999999999' }],
    [{ ...validExpense, date: '2026-02-30' }],
    [{ ...validExpense, category: 'invalid' }],
  ])('rejects invalid expense values', (value) => {
    expect(expenseFormSchema.safeParse(value).success).toBe(false);
  });
});
