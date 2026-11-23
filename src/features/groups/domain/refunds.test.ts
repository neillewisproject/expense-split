import { computeBalances } from '@/features/expenses/domain/balances';
import type { GroupExpense, GroupWithDetails } from './group';
import {
  calculateGroupRefund,
  convertRefundSource,
  refundBudget,
  validateGroupRefunds,
} from './refunds';

function ledger(fx = false): GroupWithDetails {
  const now = '2026-11-23T00:00:00.000Z';
  return {
    id: 'group',
    name: 'Trip',
    currency: 'INR',
    ownerId: null,
    revision: 0,
    localRevision: 0,
    archivedAt: null,
    createdAt: now,
    syncUserId: null,
    syncStatus: 'local',
    inviteCode: null,
    meMemberId: 'a',
    conflictMessage: null,
    activity: [],
    members: ['a', 'b'].map((id) => ({
      id,
      groupId: 'group',
      name: id,
      createdAt: now,
      deactivatedAt: null,
      userId: null,
    })),
    expenses: [
      {
        id: 'original',
        description: 'Dinner',
        amount: fx ? 101 : 100,
        paidBy: 'a',
        contributions: { a: fx ? 101 : 100 },
        split: { a: fx ? 51 : 50, b: 50 },
        currency: 'INR',
        date: '2026-11-23',
        kind: 'expense',
        splitInputs: null,
        category: 'food',
        notes: '',
        method: '',
        reference: '',
        authorId: null,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        deletedAt: null,
        itemized: null,
        receipts: [],
        conversion: fx
          ? {
              originalAmount: 100,
              originalCurrency: 'USD',
              rate: '1.01',
              originalExponent: 2,
              baseExponent: 2,
              originalSplit: { a: 50, b: 50 },
              originalContributions: { a: 100 },
              splitInputs: null,
              itemized: null,
            }
          : null,
      },
    ],
  };
}
function addRefund(group: GroupWithDetails, amount: number, id: string): GroupExpense {
  const result: GroupExpense = {
    ...group.expenses[0]!,
    ...calculateGroupRefund(group, 'original', amount),
    id,
    kind: 'refund',
    conversion: null,
    splitInputs: null,
    itemized: null,
  };
  group.expenses.push(result);
  return result;
}

test('partial followed by full refund exhausts original/base payer and owed budgets exactly', () => {
  const group = ledger(true);
  const first = addRefund(group, 50, 'first');
  const final = addRefund(group, 50, 'final');
  expect(first.amount).toBe(51);
  expect(final.amount).toBe(50);
  expect(final.refundSnapshot?.baseRoundingAdjustment).toBe(-1);
  expect(refundBudget(group, 'original').baseSplit).toEqual({ total: 0, parts: { a: 0, b: 0 } });
  expect(refundBudget(group, 'original').sourcePayers).toEqual({ total: 0, parts: { a: 0 } });
  expect(computeBalances(group.expenses)).toEqual({ a: 0, b: 0 });
  expect(() => validateGroupRefunds(group)).not.toThrow();
  expect(() => calculateGroupRefund(group, 'original', 1)).toThrow(/remaining/);
});

test('void releases budgets but restoration cannot exceed replacement refunds', () => {
  const group = ledger();
  const first = addRefund(group, 60, 'first');
  first.deletedAt = '2026-11-24T00:00:00.000Z';
  addRefund(group, 100, 'replacement');
  expect(() => validateGroupRefunds(group)).not.toThrow();
  first.deletedAt = null;
  expect(() => validateGroupRefunds(group)).toThrow(/exceed/);
});

test('refunds cap every original participant, not just the total', () => {
  const group = ledger();
  const refund = addRefund(group, 40, 'first');
  refund.split = { a: 40, b: 0 };
  const other = addRefund(group, 40, 'second');
  other.split = { a: 40, b: 0 };
  expect(() => validateGroupRefunds(group)).toThrow(/allocation/);
});

test('refund history freezes original financial snapshots but permits cosmetic edits and JSON key reordering', () => {
  const group = ledger(true);
  addRefund(group, 20, 'refund');
  const before = JSON.parse(JSON.stringify(group)) as GroupWithDetails;
  group.expenses[0]!.notes = 'Corrected note';
  const conversion = group.expenses[0]!.conversion!;
  group.expenses[0]!.conversion = { ...conversion, originalSplit: { b: 50, a: 50 } };
  expect(() => validateGroupRefunds(group, before)).not.toThrow();
  group.expenses[0]!.paidBy = 'b';
  expect(() => validateGroupRefunds(group, before)).toThrow(/financial/);
});

test('original deletion, unrelated links, and conversion from an existing expense are rejected', () => {
  const group = ledger();
  const refund = addRefund(group, 10, 'refund');
  group.expenses[0]!.deletedAt = '2026-11-24T00:00:00.000Z';
  expect(() => validateGroupRefunds(group)).toThrow(/Restore/);
  group.expenses[0]!.deletedAt = null;
  const before = JSON.parse(JSON.stringify(group)) as GroupWithDetails;
  refund.kind = 'expense';
  refund.refundOfId = null;
  refund.refundSnapshot = null;
  expect(() => validateGroupRefunds(group, before)).toThrow(/links|kinds/);
});

test('fixed exponents are used and unrepresentable partial FX refunds cannot strand base minor units', () => {
  expect(convertRefundSource(1000, '1', 3, 0)).toBe(1);
  const group = ledger(true);
  const original = group.expenses[0]!;
  original.amount = 2;
  original.split = { a: 2 };
  original.contributions = { a: 2 };
  original.conversion = {
    ...original.conversion!,
    originalAmount: 3,
    rate: '0.5',
    originalSplit: { a: 3 },
    originalContributions: { a: 3 },
  };
  addRefund(group, 1, 'first');
  expect(() => calculateGroupRefund(group, 'original', 1)).toThrow(/represented safely/);
  expect(calculateGroupRefund(group, 'original', 2).amount).toBe(1);
});
