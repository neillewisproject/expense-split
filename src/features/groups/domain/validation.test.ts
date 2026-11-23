import type { GroupExpense, GroupWithDetails } from './group';
import { calculateSavedSplit } from './split-inputs';
import { canEditExpense, validateGroupExpense } from './validation';
import { convertGroupAllocation } from './conversion';

const group: GroupWithDetails = {
  id: 'group',
  name: 'Trip',
  currency: 'INR',
  ownerId: 'owner',
  revision: 0,
  localRevision: 1,
  archivedAt: null,
  createdAt: '2026-11-23T00:00:00.000Z',
  syncUserId: 'member',
  syncStatus: 'pending',
  inviteCode: null,
  meMemberId: null,
  conflictMessage: null,
  activity: [],
  expenses: [],
  members: ['a', 'b', 'c'].map((id) => ({
    id,
    groupId: 'group',
    name: id,
    createdAt: '2026-11-23T00:00:00.000Z',
    deactivatedAt: null,
    userId: null,
  })),
};

function expense(changes: Partial<GroupExpense> = {}): GroupExpense {
  return {
    id: 'expense',
    description: 'Dinner',
    amount: 10001,
    paidBy: 'c',
    split: { a: 5001, b: 5000 },
    contributions: { a: 3000, c: 7001 },
    currency: 'INR',
    date: '2026-11-23',
    kind: 'expense',
    splitInputs: { mode: 'equally', memberIds: ['a', 'b'], values: {} },
    category: 'food',
    notes: '',
    method: '',
    reference: '',
    authorId: 'member',
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    revision: 1,
    deletedAt: null,
    receipts: [],
    itemized: null,
    conversion: null,
    ...changes,
  };
}

test('a payer outside the selected split may contribute without owing a share', () => {
  expect(() => validateGroupExpense(group, expense())).not.toThrow();
  expect(() => validateGroupExpense(group, expense({ contributions: { c: 10000 } }))).toThrow(
    /sum|add up/,
  );
  expect(() =>
    validateGroupExpense(group, expense({ contributions: { stranger: 10001 } })),
  ).toThrow(/group members|add up/);
});

test('saved exact, percentage, share and signed adjustment inputs preserve their allocations', () => {
  const examples = [
    { mode: 'exact' as const, memberIds: ['a', 'b'], values: { a: 6001, b: 4000 } },
    { mode: 'percentages' as const, memberIds: ['a', 'b'], values: { a: 60, b: 40 } },
    { mode: 'shares' as const, memberIds: ['a', 'b'], values: { a: 3, b: 2 } },
    { mode: 'adjustments' as const, memberIds: ['a', 'b'], values: { a: -500, b: 500 } },
  ];
  for (const splitInputs of examples) {
    const split = calculateSavedSplit(10001, splitInputs);
    expect(() => validateGroupExpense(group, expense({ splitInputs, split }))).not.toThrow();
    expect(Object.values(split).reduce((sum, value) => sum + value, 0)).toBe(10001);
  }
  expect(() =>
    validateGroupExpense(
      group,
      expense({
        splitInputs: { mode: 'exact', memberIds: ['a', 'b'], values: { a: 5000, b: 5001 } },
      }),
    ),
  ).toThrow(/do not match/);
});

test('legacy authorless shared entries remain owner-managed', () => {
  const legacy = expense({ authorId: null });
  expect(canEditExpense(group, legacy, 'member')).toBe(false);
  expect(canEditExpense(group, legacy, 'owner')).toBe(true);
  expect(canEditExpense(group, expense(), 'member')).toBe(true);
  expect(canEditExpense({ ...group, syncUserId: null }, legacy, null)).toBe(true);
});

test('custom settlements require different sender and recipient with a conserved total', () => {
  const settlement = expense({
    amount: 1234,
    kind: 'settlement',
    paidBy: 'a',
    contributions: { a: 1234 },
    split: { b: 1234 },
    splitInputs: null,
  });
  expect(() => validateGroupExpense(group, settlement)).not.toThrow();
  expect(() => validateGroupExpense(group, { ...settlement, split: { a: 1234 } })).toThrow(
    /different recipient/,
  );
});

test('foreign allocations must match the saved historical conversion including rounding', () => {
  const foreign = expense({
    amount: 101,
    split: { a: 51, b: 50 },
    contributions: { c: 101 },
    splitInputs: null,
    conversion: {
      originalAmount: 100,
      originalCurrency: 'USD',
      rate: '1.01',
      originalExponent: 2,
      baseExponent: 2,
      originalSplit: { a: 50, b: 50 },
      originalContributions: { c: 100 },
      splitInputs: { mode: 'equally', memberIds: ['a', 'b'], values: {} },
      itemized: null,
    },
  });
  expect(() => validateGroupExpense(group, foreign)).not.toThrow();
  expect(() => validateGroupExpense(group, { ...foreign, split: { a: 50, b: 51 } })).toThrow(
    /fixed original exchange rate/,
  );
});

test('saved itemization cannot allocate another group participant', () => {
  const splitInputs = { mode: 'itemized' as const, memberIds: ['a', 'b'], values: {} };
  const itemized = {
    items: [
      { id: 'item', description: 'Meal', quantity: 1, unitAmount: 10001, shares: { outsider: 1 } },
    ],
    adjustments: { discount: 0, tax: 0, tip: 0 },
  };
  expect(() => validateGroupExpense(group, expense({ splitInputs, itemized }))).toThrow(
    /participants from this group/,
  );
});

test('saved shares and itemized ties use selected order even after JSONB reorders value keys', () => {
  const inputs = { mode: 'shares' as const, memberIds: ['b', 'a'], values: { a: 1, b: 1 } };
  expect(calculateSavedSplit(101, inputs)).toEqual({ b: 51, a: 50 });
  expect(
    calculateSavedSplit(
      101,
      { ...inputs, mode: 'itemized' },
      {
        items: [
          { id: 'item', description: 'Meal', quantity: 1, unitAmount: 101, shares: { a: 1, b: 1 } },
        ],
        adjustments: { discount: 0, tax: 0, tip: 0 },
      },
    ),
  ).toEqual({ b: 51, a: 50 });
});

test('currency conversion tie breaking survives original allocation key reordering', () => {
  expect(convertGroupAllocation(100, { b: 50, a: 50 }, 'USD', 'INR', '1.01')).toEqual(
    convertGroupAllocation(100, { a: 50, b: 50 }, 'USD', 'INR', '1.01'),
  );
});
