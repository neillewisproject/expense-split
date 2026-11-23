import type { Account } from '@/features/accounts/data/schema';
import type { StoredExpense } from '@/features/expenses/data/schema';
import type { GroupCashMovement } from '@/features/group-cash/data/schema';
import type { GoalContribution, SavingsGoal } from '../data/schema';
import { goalSaved, savingsPosition, validateContribution, validateGoal } from './goals';

const now = '2026-03-01T00:00:00.000Z';
const account: Account = {
  id: 'cash',
  name: 'Cash',
  currency: 'INR',
  openingBalance: 1000,
  archived: false,
  createdAt: now,
};
const goal: SavingsGoal = {
  id: 'holiday',
  name: 'Holiday',
  accountId: 'cash',
  currency: 'INR',
  target: 900,
  targetDate: null,
  createdAt: now,
  updatedAt: now,
};
const other = { ...goal, id: 'emergency' };
const contributions: GoalContribution[] = [
  { id: 'a', goalId: 'holiday', amount: 700, date: '2026-03-01', note: '', createdAt: now },
  { id: 'b', goalId: 'emergency', amount: 200, date: '2026-03-01', note: '', createdAt: now },
];
const input = { amount: 100, date: '2026-03-01', note: '' };
it('reserves existing cash across all goals without moving account money', () => {
  expect(savingsPosition(account, [goal, other], contributions, [])).toEqual({
    balance: 1000,
    reserved: 900,
    available: 100,
    underfunded: false,
  });
  expect(() =>
    validateContribution(goal, input, [account], [goal, other], contributions, [], '2026-03-01'),
  ).not.toThrow();
  expect(() =>
    validateContribution(
      goal,
      { ...input, amount: 101 },
      [account],
      [goal, other],
      contributions,
      [],
      '2026-03-01',
    ),
  ).toThrow('unreserved');
  expect(goalSaved(goal.id, contributions)).toBe(700);
});
it('allows releases but never releases more than a goal holds', () => {
  expect(() =>
    validateContribution(
      goal,
      { ...input, amount: -700 },
      [{ ...account, archived: true }],
      [goal, other],
      contributions,
      [],
      '2026-03-01',
    ),
  ).not.toThrow();
  expect(() =>
    validateContribution(
      goal,
      { ...input, amount: -701 },
      [account],
      [goal, other],
      contributions,
      [],
      '2026-03-01',
    ),
  ).toThrow('Release');
});
it('shows underfunding after account spending and prevents further unsupported reservations', () => {
  const expense: StoredExpense = {
    id: 'meal',
    description: 'Meal',
    category: 'food',
    amount: 450,
    date: '2026-03-01',
    accountId: account.id,
    receiptUri: null,
    createdAt: now,
    updatedAt: now,
  };
  expect(savingsPosition(account, [goal, other], contributions, [expense])).toMatchObject({
    balance: 550,
    available: -350,
    underfunded: true,
  });
  expect(() =>
    validateContribution(
      goal,
      input,
      [account],
      [goal, other],
      contributions,
      [expense],
      '2026-03-01',
    ),
  ).toThrow('unreserved');
});
it('accounts for linked group cash when calculating and reserving available funds', () => {
  const movement: GroupCashMovement = {
    id: 'group-payment',
    groupId: 'trip',
    expenseId: 'meal',
    memberId: 'me',
    groupUserId: null,
    accountId: 'cash',
    personalEntryId: null,
    currency: 'INR',
    amount: 150,
    direction: 'out',
    date: '2026-03-01',
    description: 'Meal',
    groupName: 'Trip',
    expenseRevision: 1,
    createdAt: now,
    voidedAt: null,
  };
  expect(savingsPosition(account, [goal, other], contributions, [], [movement])).toMatchObject({
    balance: 850,
    available: -50,
    underfunded: true,
  });
  expect(() =>
    validateContribution(goal, input, [account], [goal, other], contributions, [], '2026-03-01', [
      movement,
    ]),
  ).toThrow('unreserved');
  expect(
    savingsPosition(account, [goal, other], contributions, [], [{ ...movement, voidedAt: now }])
      .available,
  ).toBe(100);
});
it('rejects wrong-currency accounts, future dates and invalid targets', () => {
  expect(() => validateGoal({ ...goal, target: 0 }, [account])).toThrow('positive target');
  expect(() => validateGoal(goal, [{ ...account, currency: 'USD' }])).toThrow('matching-currency');
  expect(() =>
    validateContribution(
      goal,
      { ...input, date: '2026-03-02' },
      [account],
      [goal],
      [],
      [],
      '2026-03-01',
    ),
  ).toThrow('no later');
});
