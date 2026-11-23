import type { GroupWithDetails } from './domain/group';
import { useGroupsStore } from './store';

let mockPersisted: GroupWithDetails;
let mockOperations: Record<string, unknown>[] = [];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
jest.mock('expo-crypto', () => ({ randomUUID: () => `operation-${mockOperations.length}` }));
jest.mock('./data/local-ledger', () => ({
  ...jest.requireActual<typeof import('./data/local-ledger')>('./data/local-ledger'),
  readGroups: async () => [JSON.parse(JSON.stringify(mockPersisted))],
  writeLedger: (_tx: unknown, group: GroupWithDetails) => {
    mockPersisted = JSON.parse(JSON.stringify(group));
  },
}));
const mockDb = {
  select: () => ({ from: () => ({ where: async () => mockOperations }) }),
  insert: () => ({
    values: (row: Record<string, unknown>) => ({ run: () => mockOperations.push(row) }),
  }),
  transaction: (work: (tx: unknown) => void) => work(mockDb),
};
jest.mock('@/features/expenses/data/database', () => ({ getExpenseDatabase: async () => mockDb }));

beforeEach(() => {
  const now = '2026-11-23T00:00:00.000Z';
  mockOperations = [];
  mockPersisted = {
    id: 'group',
    name: 'Trip',
    currency: 'INR',
    ownerId: 'owner',
    revision: 0,
    localRevision: 0,
    archivedAt: null,
    createdAt: now,
    syncUserId: 'owner',
    syncStatus: 'synced',
    inviteCode: null,
    meMemberId: null,
    conflictMessage: null,
    activity: [],
    members: ['a', 'b'].map((id) => ({
      id,
      groupId: 'group',
      name: id,
      createdAt: now,
      userId: null,
      deactivatedAt: null,
    })),
    expenses: [
      {
        id: 'original',
        description: 'Dinner',
        amount: 10000,
        paidBy: 'a',
        split: { a: 5000, b: 5000 },
        contributions: { a: 10000 },
        currency: 'INR',
        kind: 'expense',
        date: '2026-11-23',
        category: 'food',
        notes: '',
        method: '',
        reference: '',
        authorId: 'owner',
        createdAt: now,
        updatedAt: now,
        revision: 1,
        deletedAt: null,
        itemized: null,
        splitInputs: null,
        conversion: null,
        receipts: [],
      },
    ],
  };
  useGroupsStore.setState({
    groups: [copy(mockPersisted)],
    activeUserId: 'owner',
    status: 'ready',
    error: null,
  });
});

test('a persisted linked refund and its outbox snapshot conserve allocations; stale-store retries are idempotent', async () => {
  const input = { sourceAmount: 1000, date: '2026-11-23', notes: 'Partial return' };
  await useGroupsStore
    .getState()
    .recordGroupRefund('group', 'original', input, undefined, 'refund');
  expect(mockPersisted.expenses[1]).toMatchObject({
    id: 'refund',
    kind: 'refund',
    refundOfId: 'original',
    amount: 1000,
    contributions: { a: 1000 },
    split: { a: 500, b: 500 },
  });
  expect(mockOperations).toHaveLength(1);
  expect(mockOperations[0]?.snapshot).toMatchObject({
    expenses: [
      expect.anything(),
      expect.objectContaining({ kind: 'refund', refundOfId: 'original' }),
    ],
  });
  useGroupsStore.setState({
    groups: [{ ...copy(mockPersisted), expenses: [copy(mockPersisted.expenses[0]!)] }],
  });
  await useGroupsStore
    .getState()
    .recordGroupRefund('group', 'original', input, undefined, 'refund');
  expect(mockPersisted.expenses).toHaveLength(2);
  expect(mockOperations).toHaveLength(1);
  await expect(
    useGroupsStore
      .getState()
      .recordGroupRefund(
        'group',
        'original',
        { ...input, sourceAmount: 2000 },
        undefined,
        'refund',
      ),
  ).rejects.toThrow(/different input/);
  expect(mockOperations).toHaveLength(1);
});

test('invalid original financial corrections never persist or enqueue once refund history exists', async () => {
  await useGroupsStore
    .getState()
    .recordGroupRefund(
      'group',
      'original',
      { sourceAmount: 1000, date: '2026-11-23', notes: '' },
      undefined,
      'refund',
    );
  await expect(
    useGroupsStore.getState().editGroupExpense('group', 'original', {
      ...mockPersisted.expenses[0]!,
      amount: 11000,
      split: { a: 5500, b: 5500 },
      contributions: { a: 11000 },
    }),
  ).rejects.toThrow(/refund history/);
  expect(mockPersisted.expenses[0]?.amount).toBe(10000);
  expect(mockOperations).toHaveLength(1);
  await expect(
    useGroupsStore.getState().editGroupExpense('group', 'refund', mockPersisted.expenses[1]!),
  ).rejects.toThrow(/linked refund form/);
});
