import type { Account } from '@/features/accounts/data/schema';
import { accountBalance, consumption } from '@/features/expenses/domain/ledger';
import type { GroupExpense, GroupWithDetails } from '@/features/groups/domain/group';
import type { GroupCashMovement } from '../data/schema';
import {
  groupCashOption,
  validateCashMatch,
  validateCashMovement,
  validateMatchedTransaction,
} from './cash';

const now = '2026-03-01T00:00:00.000Z';
const account: Account = {
  id: 'cash',
  name: 'Cash',
  currency: 'INR',
  openingBalance: 10000,
  archived: false,
  createdAt: now,
};
const meal: GroupExpense = {
  id: 'meal',
  description: 'Meal',
  amount: 1000,
  currency: 'INR',
  date: '2026-03-01',
  createdAt: now,
  updatedAt: now,
  kind: 'expense',
  paidBy: 'me',
  contributions: { me: 700, other: 300 },
  split: { me: 400, other: 600 },
  splitInputs: null,
  category: 'food',
  notes: '',
  method: '',
  reference: '',
  authorId: null,
  revision: 1,
  deletedAt: null,
  itemized: null,
  receipts: [],
  conversion: null,
};
const group: GroupWithDetails = {
  id: 'g',
  name: 'Trip',
  currency: 'INR',
  ownerId: null,
  revision: 1,
  localRevision: 1,
  archivedAt: null,
  createdAt: now,
  syncUserId: null,
  syncStatus: 'local',
  inviteCode: null,
  conflictMessage: null,
  meMemberId: 'me',
  activity: [],
  expenses: [meal],
  members: ['me', 'other'].map((id) => ({
    id,
    groupId: 'g',
    name: id,
    createdAt: now,
    deactivatedAt: null,
    userId: null,
  })),
};
function movement(
  input: ReturnType<typeof groupCashOption>,
  overrides: Partial<GroupCashMovement> = {},
): GroupCashMovement {
  return {
    ...input,
    id: 'movement',
    accountId: 'cash',
    personalEntryId: null,
    createdAt: now,
    voidedAt: null,
    ...overrides,
  };
}
it('uses actual payer contributions and treats group refunds and settlements as cash, not spending', () => {
  const paid = groupCashOption(group, meal, null);
  expect(paid).toMatchObject({ amount: 700, direction: 'out', memberId: 'me' });
  const refund = groupCashOption(
    group,
    {
      ...meal,
      id: 'refund',
      kind: 'refund',
      amount: 200,
      contributions: { me: 140, other: 60 },
      split: { me: 80, other: 120 },
    },
    null,
  );
  expect(refund).toMatchObject({ amount: 140, direction: 'in' });
  const settlement = groupCashOption(
    group,
    {
      ...meal,
      id: 'settlement',
      kind: 'settlement',
      amount: 300,
      paidBy: 'other',
      contributions: { other: 300 },
      split: { me: 300 },
    },
    null,
  );
  expect(settlement).toMatchObject({ amount: 300, direction: 'in' });
  const cash = [
    movement(paid),
    movement(refund, { id: 'refund' }),
    movement(settlement, { id: 'settlement' }),
  ];
  expect(accountBalance(account, [], cash)).toBe(9740);
  expect(
    consumption({
      id: 'personal',
      description: 'Meal',
      amount: 200,
      category: 'food',
      date: meal.date,
      receiptUri: null,
      createdAt: now,
      updatedAt: now,
    }),
  ).toBe(200);
  expect(accountBalance(account, [], [{ ...cash[0]!, voidedAt: now }])).toBe(10000);
});
it('matches only a single compatible personal transaction without double-counting the account', () => {
  const input = groupCashOption(group, meal, null);
  const entry = {
    id: 'personal-payment',
    description: 'Meal',
    amount: input.amount,
    category: 'food' as const,
    date: meal.date,
    accountId: 'cash',
    receiptUri: null,
    createdAt: now,
    updatedAt: now,
  };
  const match = movement(input, { personalEntryId: entry.id });
  expect(() => validateCashMatch(match, entry, [])).not.toThrow();
  expect(() => validateCashMatch(match, entry, [match])).toThrow('already matched');
  expect(() => validateCashMatch(match, { ...entry, amount: 1 }, [])).toThrow('same account');
  expect(() => validateCashMatch(match, { ...entry, entryType: 'transfer' }, [])).toThrow(
    'same account',
  );
  expect(accountBalance(account, [entry], [match])).toBe(9300);
  expect(accountBalance(account, [entry], [{ ...match, voidedAt: now }])).toBe(9300);
  expect(() => accountBalance(account, [], [match])).toThrow('invalid or duplicate');
  expect(() => validateMatchedTransaction({ ...entry, amount: 1 }, [match])).toThrow('Void');
  expect(() => validateMatchedTransaction({ ...entry, deletedAt: now }, [match])).toThrow('Void');
  expect(() => validateMatchedTransaction({ ...entry, notes: 'updated' }, [match])).not.toThrow();
});
it('matches received group cash only to personal income or refunds', () => {
  const input = groupCashOption(
    group,
    {
      ...meal,
      kind: 'settlement',
      amount: 300,
      paidBy: 'other',
      contributions: { other: 300 },
      split: { me: 300 },
    },
    null,
  );
  const entry = {
    id: 'repayment',
    description: 'Repayment',
    amount: 300,
    category: 'food' as const,
    date: meal.date,
    accountId: 'cash',
    receiptUri: null,
    createdAt: now,
    updatedAt: now,
  };
  const match = movement(input, { personalEntryId: entry.id });
  expect(() => validateCashMatch(match, entry, [])).toThrow('direction');
  for (const entryType of ['income', 'refund'] as const) {
    const received = { ...entry, entryType };
    expect(() => validateCashMatch(match, received, [])).not.toThrow();
    expect(accountBalance(account, [received], [match])).toBe(10300);
  }
});
it('requires explicit current identity, matching account, and a single active snapshot', () => {
  const input = groupCashOption(group, meal, null);
  expect(() => validateCashMovement(input, account, [])).not.toThrow();
  expect(() => validateCashMovement(input, { ...account, currency: 'USD' }, [])).toThrow(
    'group base currency',
  );
  expect(() => validateCashMovement(input, account, [movement(input)])).toThrow('already linked');
  expect(() =>
    validateCashMovement(input, account, [movement(input, { voidedAt: now })]),
  ).not.toThrow();
  expect(() => groupCashOption({ ...group, meMemberId: null }, meal, null)).toThrow('participant');
  const shared = {
    ...group,
    syncUserId: 'owner',
    members: group.members.map((member) => ({
      ...member,
      userId: member.id === 'me' ? 'owner' : null,
    })),
  };
  expect(groupCashOption(shared, meal, 'owner').memberId).toBe('me');
  expect(() => groupCashOption(shared, meal, 'different')).toThrow('different');
  expect(() => groupCashOption({ ...group, syncStatus: 'conflict' }, meal, null)).toThrow(
    'conflict',
  );
  expect(() => groupCashOption(group, { ...meal, deletedAt: now }, null)).toThrow('Restore');
});
