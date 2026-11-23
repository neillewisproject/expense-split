import type { StoredExpense } from '@/features/expenses/data/schema';
import {
  budgetProgress,
  ownGroupConsumption,
  plannedCommitments,
  periodReport,
  rangeReport,
  reportComparison,
} from './reports';
import type { RecurringDraft, RecurringRule } from '@/features/recurrence/data/schema';
import type { GroupExpense, GroupWithDetails } from '@/features/groups/domain/group';
import type { GroupCashMovement } from '@/features/group-cash/data/schema';

const row: StoredExpense = {
  id: 'meal',
  description: 'Meal',
  amount: 2000,
  date: '2026-03-01',
  category: 'food',
  accountId: 'cash',
  tags: '["holiday"]',
  receiptUri: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};
const rows: StoredExpense[] = [
  row,
  {
    ...row,
    id: 'refund',
    entryType: 'refund',
    refundOfId: 'meal',
    amount: 500,
    accountId: 'bank',
    tags: '[]',
  },
  { ...row, id: 'income', entryType: 'income', amount: 5000 },
  { ...row, id: 'transfer', entryType: 'transfer', amount: 9999 },
  { ...row, id: 'usd', currency: 'USD', amount: 9999 },
  { ...row, id: 'deleted', deletedAt: row.createdAt, amount: 9999 },
];
it('reconciles net consumption and income separately per currency', () => {
  expect(periodReport(rows, '2026-03', 'INR')).toMatchObject({
    spending: 1500,
    income: 5000,
    net: 3500,
    categories: [{ category: 'food', amount: 1500 }],
  });
});
it('subtracts linked refunds from the original consumption account and tag budget', () => {
  const budget = {
    id: 'b',
    name: 'Food',
    month: '2026-03',
    currency: 'INR',
    amount: 1800,
    category: 'food',
    accountId: 'cash',
    tag: 'holiday',
    threshold: 80,
  };
  expect(budgetProgress(budget, rows)).toEqual({
    spent: 1500,
    remaining: 300,
    percent: 83,
    warning: true,
  });
});

it('uses inclusive report dates and compares signed cash-flow totals', () => {
  const current = rangeReport(
    [row, { ...row, id: 'end', date: '2026-03-02' }, { ...row, id: 'outside', date: '2026-03-03' }],
    { start: '2026-03-01', end: '2026-03-02' },
    'INR',
  );
  expect(current.spending).toBe(4000);
  expect(reportComparison(current, periodReport([row], '2026-02', 'INR'))).toEqual({
    spending: 4000,
    income: 0,
    net: -4000,
  });
});
it('carries only unused funds through an explicit matching monthly budget chain', () => {
  const base = {
    id: 'jan',
    name: 'Food',
    month: '2026-01',
    currency: 'INR',
    amount: 10000,
    category: 'food',
    accountId: null,
    tag: null,
    threshold: 80,
  };
  const feb = { ...base, id: 'feb', month: '2026-02', carryoverFromId: 'jan' };
  const march = { ...base, id: 'march', month: '2026-03', carryoverFromId: 'feb' };
  const spending = [
    { ...row, date: '2026-01-01', amount: 4000 },
    { ...row, id: 'feb-expense', date: '2026-02-01', amount: 13000 },
  ];
  expect(budgetProgress(march, spending, [base, feb, march])).toMatchObject({
    carryover: 3000,
    limit: 13000,
    remaining: 13000,
  });
  expect(
    budgetProgress(feb, [{ ...row, date: '2026-01-01', amount: 11000 }], [base, feb]),
  ).toMatchObject({ carryover: 0, limit: 10000 });
  expect(() => budgetProgress({ ...feb, category: 'transport' }, [], [base, feb])).toThrow(
    'identical',
  );
  expect(() => budgetProgress(feb, [], [])).toThrow('Carryover');
});
const groupEntry: GroupExpense = {
  id: 'shared-meal',
  description: 'Shared meal',
  amount: 1000,
  currency: 'INR',
  kind: 'expense',
  date: '2026-03-01',
  paidBy: 'me',
  split: { me: 300, other: 700 },
  contributions: { me: 1000 },
  splitInputs: null,
  category: 'food',
  notes: '',
  method: '',
  reference: '',
  authorId: null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  revision: 0,
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
  revision: 0,
  archivedAt: null,
  createdAt: row.createdAt,
  members: [
    {
      id: 'me',
      name: 'Same name',
      groupId: 'g',
      createdAt: row.createdAt,
      deactivatedAt: null,
      userId: null,
    },
  ],
  expenses: [groupEntry],
  activity: [],
  syncUserId: null,
  syncStatus: 'local',
  inviteCode: null,
  localRevision: 0,
  meMemberId: 'me',
  conflictMessage: null,
};
it('combines attributed group shares with personal consumption without recounting matched cash', () => {
  const payment = { ...row, id: 'group-payment', amount: 1000 };
  const movement: GroupCashMovement = {
    id: 'link',
    groupId: 'g',
    expenseId: 'shared-meal',
    memberId: 'me',
    groupUserId: null,
    accountId: 'cash',
    personalEntryId: payment.id,
    currency: 'INR',
    amount: 1000,
    direction: 'out',
    date: '2026-03-01',
    description: 'Shared meal',
    groupName: 'Trip',
    expenseRevision: 0,
    createdAt: row.createdAt,
    voidedAt: null,
  };
  const groupRefund = {
    ...groupEntry,
    id: 'group-refund',
    kind: 'refund' as const,
    amount: 200,
    contributions: { me: 200 },
    split: { me: 60, other: 140 },
  };
  const combinedGroup = {
    ...group,
    expenses: [
      groupEntry,
      groupRefund,
      { ...groupEntry, id: 'settlement', kind: 'settlement' as const },
    ],
  };
  const budget = {
    id: 'b',
    name: 'Food',
    month: '2026-03',
    currency: 'INR',
    amount: 10000,
    category: 'food',
    accountId: null,
    tag: null,
    threshold: 80,
    basis: 'combined' as const,
  };
  const context = { groups: [combinedGroup], movements: [movement], userId: null };
  expect(budgetProgress(budget, [payment, row], [], context).spent).toBe(2240);
  expect(
    budgetProgress({ ...budget, category: 'transport' }, [payment, row], [], context).spent,
  ).toBe(0);
  expect(() => budgetProgress({ ...budget, accountId: 'cash' }, [payment], [], context)).toThrow(
    'account or tag',
  );
  expect(() => budgetProgress(budget, [payment], [], { ...context, groups: [] })).toThrow(
    'unavailable',
  );
  expect(() =>
    budgetProgress(budget, [payment], [], {
      ...context,
      groups: [{ ...combinedGroup, expenses: [{ ...groupEntry, revision: 1 }] }],
    }),
  ).toThrow('changed');
  expect(() =>
    budgetProgress(budget, [payment], [], {
      ...context,
      movements: [movement, { ...movement, id: 'duplicate' }],
    }),
  ).toThrow('duplicated');
  expect(() =>
    budgetProgress(budget, [], [], {
      groups: [{ ...group, expenses: [{ ...groupEntry, split: { me: 300 } }] }],
      movements: [],
      userId: null,
    }),
  ).toThrow('allocations');
  expect(() =>
    budgetProgress(budget, [], [], {
      groups: [{ ...group, meMemberId: null }],
      movements: [],
      userId: null,
    }),
  ).toThrow('participant');
});
it('carries forward combined spending only from a matching-basis budget', () => {
  const previous = {
    id: 'previous',
    name: 'Food',
    month: '2026-01',
    currency: 'INR',
    amount: 1000,
    category: 'food',
    accountId: null,
    tag: null,
    threshold: 80,
    basis: 'combined' as const,
  };
  const current = { ...previous, id: 'current', month: '2026-02', carryoverFromId: previous.id };
  const context = {
    groups: [{ ...group, expenses: [{ ...groupEntry, date: '2026-01-15' }] }],
    movements: [],
    userId: null,
  };
  expect(budgetProgress(current, [], [previous, current], context)).toMatchObject({
    spent: 0,
    carryover: 700,
    limit: 1700,
  });
  expect(() =>
    budgetProgress(current, [], [{ ...previous, basis: 'personal' }, current], context),
  ).toThrow('identical');
});
it('shows only unposted, in-period, same-currency drafts and the next eligible occurrence', () => {
  const template = JSON.stringify({
    description: 'Rent',
    amount: 1000,
    currency: 'INR',
    entryType: 'expense',
  });
  const schedule: RecurringRule = {
    id: 'rent',
    name: 'Rent',
    template,
    startDate: '2026-03-01',
    frequency: 'monthly',
    interval: 1,
    nextDate: '2026-03-31',
    endDate: '2026-03-31',
    timeZone: 'Asia/Kolkata',
    active: true,
  };
  const pending: RecurringDraft = {
    id: 'rent:2026-03-01',
    ruleId: 'rent',
    date: '2026-03-01',
    template,
    status: 'pending',
  };
  const drafts: RecurringDraft[] = [
    pending,
    { ...pending, id: 'rent:2026-03-02', date: '2026-03-02', status: 'approved' },
    { ...pending, id: 'rent:2026-03-03', date: '2026-03-03', status: 'skipped' },
    {
      ...pending,
      id: 'usd',
      template: JSON.stringify({ description: 'USD', amount: 10, currency: 'USD' }),
    },
  ];
  const period = { start: '2026-03-01', end: '2026-03-31' };
  expect(
    plannedCommitments([schedule], drafts, period, 'INR').map((item) => [item.id, item.draft]),
  ).toEqual([
    ['rent:2026-03-01', true],
    ['rent:2026-03-31', false],
  ]);
  expect(plannedCommitments([{ ...schedule, active: false }], drafts, period, 'INR')).toHaveLength(
    1,
  );
  expect(
    plannedCommitments([{ ...schedule, endDate: '2026-03-30' }], drafts, period, 'INR'),
  ).toHaveLength(1);
  expect(
    plannedCommitments(
      [schedule],
      [...drafts, { ...pending, id: 'rent:2026-03-31', date: '2026-03-31' }],
      period,
      'INR',
    ),
  ).toHaveLength(2);
  expect(() => plannedCommitments([], [{ ...pending, template: '{' }], period, 'INR')).toThrow(
    'invalid template',
  );
});
it('reports explicit own group shares separately, excludes settlements/deleted rows and subtracts base-currency refunds', () => {
  const shared = {
    ...group,
    expenses: [
      groupEntry,
      {
        ...groupEntry,
        id: 'refund',
        kind: 'refund' as const,
        amount: 200,
        split: { me: 100, other: 100 },
      },
      { ...groupEntry, id: 'settled', kind: 'settlement' as const },
      { ...groupEntry, id: 'deleted', deletedAt: row.createdAt },
    ],
  };
  expect(
    ownGroupConsumption(
      [shared, { ...group, id: 'usd', currency: 'USD' }],
      { start: '2026-03-01', end: '2026-03-31' },
      'INR',
      null,
    ),
  ).toEqual({ consumption: 200, mappedGroups: 1, unmappedGroups: 0 });
  expect(periodReport([row], '2026-03', 'INR').spending).toBe(2000);
});
it('never infers “me” from names or uses another account’s cached shared groups', () => {
  const period = { start: '2026-03-01', end: '2026-03-31' };
  const unmapped = { ...group, meMemberId: null };
  expect(ownGroupConsumption([unmapped], period, 'INR', 'user')).toMatchObject({
    consumption: 0,
    unmappedGroups: 1,
  });
  const claimed = {
    ...unmapped,
    syncUserId: 'user',
    members: group.members.map((member) => ({ ...member, userId: 'user' })),
  };
  expect(ownGroupConsumption([claimed], period, 'INR', 'user').consumption).toBe(300);
  const ambiguous = {
    ...claimed,
    meMemberId: 'me',
    members: [...claimed.members, { ...claimed.members[0]!, id: 'other' }],
  };
  expect(ownGroupConsumption([ambiguous], period, 'INR', 'user')).toMatchObject({
    consumption: 0,
    unmappedGroups: 1,
  });
  expect(
    ownGroupConsumption([{ ...claimed, syncUserId: null }], period, 'INR', 'user'),
  ).toMatchObject({ consumption: 0, unmappedGroups: 1 });
  expect(
    ownGroupConsumption([{ ...claimed, syncUserId: 'different-user' }], period, 'INR', 'user')
      .consumption,
  ).toBe(0);
});
