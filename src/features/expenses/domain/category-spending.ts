import type { StoredExpense } from '../data/schema';
import { type ExpenseCategory } from './expense';
import { consumption, safeSum } from './ledger';

export type CategorySpending = {
  category: ExpenseCategory;
  amount: number;
};

export function getCategorySpending(
  expenses: StoredExpense[],
  month: string,
  currency = 'INR',
): CategorySpending[] {
  const totals = new Map<ExpenseCategory, number>();

  for (const expense of expenses) {
    if (!expense.date.startsWith(month) || (expense.currency ?? 'INR') !== currency) continue;
    totals.set(
      expense.category,
      safeSum([totals.get(expense.category) ?? 0, consumption(expense)]),
    );
  }

  return [...totals.keys()]
    .flatMap((category) => {
      const amount = totals.get(category) ?? 0;
      return amount !== 0 ? [{ category, amount }] : [];
    })
    .sort((a, b) => b.amount - a.amount);
}
