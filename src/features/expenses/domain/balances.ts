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

export type DebtSettlement = {
  from: MemberId;
  to: MemberId;
  amount: MinorUnits;
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

/** Greedily matches the largest debtors with the largest creditors. */
export function simplifyDebts(balances: Record<MemberId, MinorUnits>): DebtSettlement[] {
  const entries = Object.entries(balances);
  if (entries.some(([, amount]) => !Number.isSafeInteger(amount))) {
    throw new Error('Balances must be safe integer minor units');
  }
  if (entries.reduce((total, [, amount]) => total + amount, 0) !== 0) {
    throw new Error('Balances must sum to zero');
  }

  const creditors = entries
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => ({ id, amount }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const debtors = entries
    .filter(([, amount]) => amount < 0)
    .map(([id, amount]) => ({ id, amount: -amount }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const settlements: DebtSettlement[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    if (!creditor || !debtor) break;

    const amount = Math.min(creditor.amount, debtor.amount);
    settlements.push({ from: debtor.id, to: creditor.id, amount });
    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount === 0) creditorIndex += 1;
    if (debtor.amount === 0) debtorIndex += 1;
  }

  return settlements;
}
