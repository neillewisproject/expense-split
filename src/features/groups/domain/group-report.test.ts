import { groupReport, groupSummary } from './group-report';
import { formatMoney } from '@/features/expenses/domain/money';
import type { GroupExpense, GroupWithDetails } from './group';

it('reconciles multi-payer consumption, refunds, and settlements without counting payments as spending', () => {
  const meal: GroupExpense = {
    id: 'meal',
    description: 'Meal',
    date: '2026-03-01',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    kind: 'expense',
    amount: 1000,
    currency: 'INR',
    paidBy: 'a',
    split: { a: 300, b: 700 },
    contributions: { a: 1000 },
    deletedAt: null,
    splitInputs: null,
    category: 'food',
    notes: '',
    method: '',
    reference: '',
    authorId: null,
    revision: 1,
    itemized: null,
    receipts: [],
    conversion: null,
  };
  const group: GroupWithDetails = {
    id: 'g',
    name: 'Group',
    currency: 'INR',
    ownerId: null,
    revision: 0,
    archivedAt: null,
    createdAt: meal.createdAt,
    syncUserId: null,
    syncStatus: 'local',
    inviteCode: null,
    localRevision: 0,
    meMemberId: null,
    conflictMessage: null,
    activity: [],
    members: ['a', 'b'].map((id) => ({
      id,
      groupId: 'g',
      name: id,
      createdAt: meal.createdAt,
      deactivatedAt: null,
      userId: null,
    })),
    expenses: [
      meal,
      {
        ...meal,
        id: 'refund',
        kind: 'refund',
        amount: 200,
        split: { a: 100, b: 100 },
        contributions: { a: 200 },
      },
      {
        ...meal,
        id: 'settlement',
        kind: 'settlement',
        amount: 200,
        paidBy: 'b',
        split: { a: 200 },
        contributions: { b: 200 },
      },
      { ...meal, id: 'deleted', deletedAt: '2026-03-01T00:00:00Z' },
    ],
  };
  expect(groupReport(group)).toEqual({
    spending: 800,
    settlements: 200,
    members: {
      a: { paid: 800, consumed: 200, settlementsSent: 0, settlementsReceived: 200, balance: 400 },
      b: { paid: 0, consumed: 600, settlementsSent: 200, settlementsReceived: 0, balance: -400 },
    },
  });
  expect(() => groupReport({ ...group, expenses: [{ ...meal, currency: 'USD' }] })).toThrow(
    'currency mismatch',
  );
  const summary = groupSummary({
    ...group,
    inviteCode: 'private-invite',
    expenses: group.expenses.map((expense) => ({
      ...expense,
      notes: 'private-note',
      receipts: ['file:private-photo'],
    })),
  });
  expect(summary).toContain(`Net group spending: ${formatMoney(800, 'INR')}`);
  expect(summary).toContain(`Recorded settlements: ${formatMoney(200, 'INR')}`);
  expect(summary).toContain(`b pays a ${formatMoney(400, 'INR')}`);
  expect(summary).toContain('No payment is sent or verified');
  expect(summary).not.toMatch(/private-invite|private-note|private-photo/);
});
