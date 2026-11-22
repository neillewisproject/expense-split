import type { MinorUnits } from './money';
import type { MemberId, Split } from './split';

export type Expense = {
  id: string;
  description: string;
  amount: MinorUnits;
  paidBy: MemberId;
  split: Split;
  createdAt: string;
};

/**
 * Net balance per member across all expenses.
 * Positive = the group owes them money. Negative = they owe the group.
 */
export function computeBalances(expenses: Expense[]): Record<MemberId, MinorUnits> {
  const balances: Record<MemberId, MinorUnits> = {};

  for (const expense of expenses) {
    balances[expense.paidBy] = (balances[expense.paidBy] ?? 0) + expense.amount;
    for (const [memberId, owed] of Object.entries(expense.split)) {
      balances[memberId] = (balances[memberId] ?? 0) - owed;
    }
  }

  return balances;
}
