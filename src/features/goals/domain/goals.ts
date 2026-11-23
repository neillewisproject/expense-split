import type { Account } from '@/features/accounts/data/schema';
import type { StoredExpense } from '@/features/expenses/data/schema';
import { expenseFormSchema, localDate } from '@/features/expenses/domain/expense';
import { accountBalance, safeSum } from '@/features/expenses/domain/ledger';
import type { GoalContribution, SavingsGoal } from '../data/schema';
import type { GroupCashMovement } from '@/features/group-cash/data/schema';

export function goalSaved(goalId: string, contributions: GoalContribution[]): number {
  return safeSum(contributions.filter((row) => row.goalId === goalId).map((row) => row.amount));
}
export function savingsPosition(
  account: Account,
  goals: SavingsGoal[],
  contributions: GoalContribution[],
  entries: StoredExpense[],
  groupCash: GroupCashMovement[] = [],
) {
  const goalIds = new Set(
    goals.filter((goal) => goal.accountId === account.id).map((goal) => goal.id),
  );
  const reserved = safeSum(
    contributions.filter((row) => goalIds.has(row.goalId)).map((row) => row.amount),
  );
  const balance = accountBalance(account, entries, groupCash);
  return {
    balance,
    reserved,
    available: safeSum([balance, -reserved]),
    underfunded: reserved > Math.max(0, balance),
  };
}
export function validateGoal(
  input: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>,
  accounts: Account[],
) {
  const account = accounts.find((row) => row.id === input.accountId);
  if (!account || account.archived || account.currency !== input.currency)
    throw new Error('Choose an active matching-currency account');
  if (
    !input.name.trim() ||
    input.name.length > 80 ||
    !Number.isSafeInteger(input.target) ||
    input.target <= 0
  )
    throw new Error('Enter a goal name and positive target');
  if (input.targetDate && !expenseFormSchema.shape.date.safeParse(input.targetDate).success)
    throw new Error('Enter a valid target date or leave it empty');
}
export function validateContribution(
  goal: SavingsGoal,
  input: Pick<GoalContribution, 'amount' | 'date' | 'note'>,
  accounts: Account[],
  goals: SavingsGoal[],
  contributions: GoalContribution[],
  entries: StoredExpense[],
  today = localDate(),
  groupCash: GroupCashMovement[] = [],
) {
  if (!Number.isSafeInteger(input.amount) || input.amount === 0)
    throw new Error('Enter a nonzero safe contribution amount');
  if (!expenseFormSchema.shape.date.safeParse(input.date).success || input.date > today)
    throw new Error('Contributions must have a valid date no later than today');
  if (input.note.length > 400)
    throw new Error('Use at most 400 characters for a contribution note');
  const account = accounts.find(
    (row) => row.id === goal.accountId && row.currency === goal.currency,
  );
  if (!account) throw new Error('Goal account is missing or has a different currency');
  if (safeSum([goalSaved(goal.id, contributions), input.amount]) < 0)
    throw new Error('Release cannot exceed this goal’s reserved amount');
  if (input.amount > 0) {
    if (account.archived) throw new Error('Reopen the account before reserving more funds');
    if (input.amount > savingsPosition(account, goals, contributions, entries, groupCash).available)
      throw new Error('Contribution exceeds the account’s unreserved cash balance');
  }
}
