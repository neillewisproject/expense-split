import { accounts, type Account } from '@/features/accounts/data/schema';
import { expenses, type StoredExpense } from '@/features/expenses/data/schema';
import type { GroupWithDetails } from '@/features/groups/domain/group';
import { groupCashMovements, type GroupCashMovement } from './data/schema';
import { groupCashOption } from './domain/cash';
import { useGroupCashStore } from './store';

let mockGroup: GroupWithDetails;
let mockAccount: Account;
let mockMovements: GroupCashMovement[];
let mockEntries: StoredExpense[];
let mockUser: string | null;
let mockSwitchDuringRead: boolean;

jest.mock('expo-crypto', () => ({ randomUUID: () => `cash-${mockMovements.length}` }));
jest.mock('@/features/groups/store', () => ({
  useGroupsStore: { getState: () => ({ activeUserId: mockUser }) },
}));
jest.mock('@/features/groups/data/local-ledger', () => ({
  readGroups: async () => {
    if (mockSwitchDuringRead) mockUser = 'another-user';
    return [mockGroup];
  },
}));
const mockInsert = (table: unknown) => ({
  values: (row: GroupCashMovement) => ({
    run: () => {
      if (table !== groupCashMovements) throw new Error('Unexpected insert');
      mockMovements.push(row);
    },
  }),
});
const mockDb = {
  select: () => ({
    from: (table: unknown) => {
      const rows =
        table === accounts ? [mockAccount] : table === expenses ? mockEntries : mockMovements;
      return Object.assign(Promise.resolve(rows), { where: async () => rows });
    },
  }),
  insert: mockInsert,
  update: (table: unknown) => ({
    set: (values: Partial<GroupCashMovement>) => ({
      where: async () => {
        if (table !== groupCashMovements) throw new Error('Unexpected update');
        Object.assign(mockMovements[0]!, values);
      },
    }),
  }),
  transaction: (work: (tx: { insert: typeof mockInsert }) => void) => work(mockDb),
};
jest.mock('@/features/expenses/data/database', () => ({ getExpenseDatabase: async () => mockDb }));

beforeEach(() => {
  const now = '2026-03-01T00:00:00.000Z';
  mockUser = null;
  mockSwitchDuringRead = false;
  mockMovements = [];
  mockEntries = [
    {
      id: 'existing',
      description: 'Meal',
      amount: 500,
      category: 'food',
      date: '2026-03-01',
      accountId: 'cash',
      receiptUri: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
  mockAccount = {
    id: 'cash',
    name: 'Cash',
    currency: 'INR',
    openingBalance: 1000,
    archived: false,
    createdAt: now,
  };
  mockGroup = {
    id: 'trip',
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
    members: [
      { id: 'me', groupId: 'trip', name: 'Me', createdAt: now, deactivatedAt: null, userId: null },
    ],
    expenses: [
      {
        id: 'meal',
        description: 'Meal',
        amount: 500,
        currency: 'INR',
        date: '2026-03-01',
        createdAt: now,
        updatedAt: now,
        kind: 'expense',
        paidBy: 'me',
        contributions: { me: 500 },
        split: { me: 500 },
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
      },
    ],
  };
  useGroupCashStore.setState({ movements: [], loaded: false, error: null });
});
it('rechecks the personal transaction and prevents matching it to multiple cash snapshots', async () => {
  const expected = groupCashOption(mockGroup, mockGroup.expenses[0]!, null);
  mockEntries[0]!.amount = 499;
  await expect(
    useGroupCashStore.getState().record(expected, 'cash', null, 'existing'),
  ).rejects.toThrow('same account');
  mockEntries[0]!.amount = 500;
  await useGroupCashStore.getState().record(expected, 'cash', null, 'existing');
  expect(mockMovements[0]?.personalEntryId).toBe('existing');
  const other = { ...mockGroup.expenses[0]!, id: 'other' };
  mockGroup.expenses.push(other);
  await expect(
    useGroupCashStore
      .getState()
      .record(groupCashOption(mockGroup, other, null), 'cash', null, 'existing'),
  ).rejects.toThrow('already matched');
  expect(mockMovements).toHaveLength(1);
});

it('rejects stale reviews and a changed signed-in account before writing', async () => {
  const expected = groupCashOption(mockGroup, mockGroup.expenses[0]!, null);
  mockGroup.expenses[0]!.description = 'Changed meal';
  await expect(useGroupCashStore.getState().record(expected, 'cash', null)).rejects.toThrow(
    'changed',
  );
  mockGroup.expenses[0]!.description = 'Meal';
  mockSwitchDuringRead = true;
  await expect(useGroupCashStore.getState().record(expected, 'cash', null)).rejects.toThrow(
    'account changed',
  );
  expect(mockMovements).toHaveLength(0);
});

it('rechecks the account, blocks duplicates, and allows a correction after voiding', async () => {
  const expected = groupCashOption(mockGroup, mockGroup.expenses[0]!, null);
  mockAccount.archived = true;
  await expect(useGroupCashStore.getState().record(expected, 'cash', null)).rejects.toThrow(
    'active account',
  );
  mockAccount.archived = false;
  await useGroupCashStore.getState().record(expected, 'cash', null);
  await expect(useGroupCashStore.getState().record(expected, 'cash', null)).rejects.toThrow(
    'already linked',
  );
  await useGroupCashStore.getState().voidMovement(mockMovements[0]!.id);
  expect(mockMovements[0]!.voidedAt).not.toBeNull();
  await useGroupCashStore.getState().record(expected, 'cash', null);
  expect(mockMovements).toHaveLength(2);
  expect(mockMovements[1]).toMatchObject({ amount: 500, direction: 'out', voidedAt: null });
  expect(mockGroup.expenses[0]).toMatchObject({ amount: 500, deletedAt: null });
});
