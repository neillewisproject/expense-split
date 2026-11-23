import type { StoredExpense } from '../data/schema';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from './expense';

export type CategorySpending = {
  category: ExpenseCategory;
  amount: number;
};

export function getCategorySpending(expenses: StoredExpense[], month: string): CategorySpending[] {
  const totals = new Map<ExpenseCategory, number>();

  for (const expense of expenses) {
    if (!expense.date.startsWith(month)) continue;
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  }

  return EXPENSE_CATEGORIES.flatMap((category) => {
    const amount = totals.get(category) ?? 0;
    return amount > 0 ? [{ category, amount }] : [];
  }).sort((a, b) => b.amount - a.amount);
}
