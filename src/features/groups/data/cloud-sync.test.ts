import type { GroupExpense, GroupLedger, GroupOperation, GroupWithDetails } from '../domain/group';

import { cacheRemoteGroups, syncGroupSnapshot } from './cloud-sync';
import { toLedger } from './local-ledger';
import { administerGroup } from './administration';

const mockRows: {
  groups: Record<string, unknown>[];
  operations: GroupOperation[];
  expenses: Record<string, unknown>[];
  tombstones: Record<string, unknown>[];
} = {
  groups: [],
  operations: [],
  expenses: [],
  tombstones: [],
};
const mockRpc = jest.fn();
let mockUserId = 'user';
const mockWriteLedger = jest.fn();
const mockLoad = jest.fn(async () => undefined);
jest.mock('../store', () => ({
  useGroupsStore: { getState: () => ({ activeUserId: mockUserId, loadGroups: mockLoad }) },
}));

jest.mock('drizzle-orm', () => ({
  eq: (column: string, value: unknown) => (row: Record<string, unknown>) => row[column] === value,
  and:
    (...conditions: ((row: Record<string, unknown>) => boolean)[]) =>
    (row: Record<string, unknown>) =>
      conditions.every((condition) => condition(row)),
  asc: (column: string) => column,
}));
jest.mock('./schema', () => ({
  groups: { table: 'groups', id: 'id', syncUserId: 'syncUserId' },
  groupAccessTombstones: { table: 'tombstones', groupId: 'groupId', userId: 'userId' },
  groupExpenses: { table: 'expenses', id: 'id', groupId: 'groupId', receipts: 'receipts' },
  groupOperations: {
    table: 'operations',
    id: 'id',
    groupId: 'groupId',
    userId: 'userId',
    localRevision: 'localRevision',
  },
}));
jest.mock('./local-ledger', () => ({
  ...jest.requireActual<typeof import('./local-ledger')>('./local-ledger'),
  writeLedger: (...args: unknown[]) => mockWriteLedger(...args),
  readGroups: async () => mockRows.groups,
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-operation' }));
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: mockUserId } } } }) },
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

function mockQuery(table: { table: keyof typeof mockRows }) {
  let condition = (_row: Record<string, unknown>) => true;
  let limit = Infinity;
  const query = {
    where: (next: typeof condition) => {
      condition = next;
      return query;
    },
    orderBy: () => query,
    limit: (count: number) => {
      limit = count;
      return query;
    },
    then: (resolve: (result: unknown[]) => unknown) =>
      Promise.resolve(
        mockRows[table.table]
          .filter((row) => condition(row as unknown as Record<string, unknown>))
          .slice(0, limit)
          .map((row) => ({ ...row })),
      ).then(resolve),
  };
  return query;
}

function mockMutation(table: { table: keyof typeof mockRows }, values?: Record<string, unknown>) {
  let condition = (_row: Record<string, unknown>) => true;
  function apply() {
    if (values)
      mockRows[table.table].forEach((row) => {
        if (condition(row as unknown as Record<string, unknown>)) Object.assign(row, values);
      });
    else {
      const remaining = mockRows[table.table].filter(
        (row) => !condition(row as unknown as Record<string, unknown>),
      );
      mockRows[table.table].splice(
        0,
        Infinity,
        ...(remaining as GroupOperation[] & Record<string, unknown>[]),
      );
    }
  }
  const mutation = {
    where: (next: typeof condition) => {
      condition = next;
      return mutation;
    },
    run: apply,
    then: (resolve: (value: void) => unknown) => Promise.resolve().then(apply).then(resolve),
  };
  return mutation;
}

const mockDb = {
  select: () => ({ from: mockQuery }),
  update: (table: { table: keyof typeof mockRows }) => ({
    set: (values: Record<string, unknown>) => mockMutation(table, values),
  }),
  delete: mockMutation,
  insert: (table: { table: keyof typeof mockRows }) => ({
    values: (values: Record<string, unknown>) => {
      const run = () => {
        const rows = mockRows[table.table] as Record<string, unknown>[];
        const prior = rows.find(
          (row) => row.groupId === values.groupId && row.userId === values.userId,
        );
        if (prior) Object.assign(prior, values);
        else rows.push({ ...values });
      };
      return { run, onConflictDoUpdate: () => ({ run }) };
    },
  }),
  transaction: (work: (db: unknown) => void) => work(mockDb),
};
jest.mock('@/features/expenses/data/database', () => ({ getExpenseDatabase: async () => mockDb }));

const snapshot: GroupLedger = {
  id: 'group',
  name: 'Trip',
  currency: 'INR',
  ownerId: 'user',
  revision: 0,
  archivedAt: null,
  createdAt: '2026-11-23T00:00:00.000Z',
  members: [],
  expenses: [],
  activity: [],
};
const operation = (id: string, revision: number): GroupOperation => ({
  id,
  groupId: 'group',
  userId: 'user',
  baseRevision: revision - 1,
  localRevision: revision,
  snapshot,
  createdAt: '2026-11-23T00:00:00.000Z',
});

beforeEach(() => {
  mockRows.groups = [
    { id: 'group', syncUserId: 'user', syncStatus: 'pending', revision: 0, inviteCode: null },
  ];
  mockRows.operations = [operation('op1', 1)];
  mockRows.expenses = [];
  mockRows.tombstones = [];
  mockUserId = 'user';
  mockRpc.mockReset();
  mockWriteLedger.mockClear();
  mockLoad.mockClear();
});

test('cached snapshots cannot resurrect access after an acknowledged leave or removal', async () => {
  mockRows.groups = [];
  mockRows.operations = [];
  mockRows.tombstones = [{ groupId: 'group', userId: 'user', revision: 5 }];
  mockRpc.mockResolvedValue({ data: [], error: null });
  await cacheRemoteGroups([{ ...snapshot, revision: 4, inviteCode: 'old' }], 'user');
  expect(mockWriteLedger).not.toHaveBeenCalled();
  expect(mockRows.tombstones).toHaveLength(1);
});

test('a confirmed rejoin uses the fresh authorized revision rather than an old cached snapshot', async () => {
  mockRows.groups = [];
  mockRows.operations = [];
  mockRows.tombstones = [{ groupId: 'group', userId: 'user', revision: 5 }];
  mockRpc.mockResolvedValue({
    data: [{ ...snapshot, revision: 7, inviteCode: 'fresh' }],
    error: null,
  });
  await cacheRemoteGroups([{ ...snapshot, revision: 4, inviteCode: 'old' }], 'user');
  expect(mockWriteLedger.mock.calls[0]?.[1].revision).toBe(7);
  expect(mockRows.tombstones).toHaveLength(0);
});

test('administrative requests are account/revision bound and cannot bypass a pending local queue', async () => {
  mockRows.groups = [
    {
      ...snapshot,
      syncUserId: 'user',
      syncStatus: 'synced',
      localRevision: 0,
      revision: 5,
      meMemberId: null,
      inviteCode: null,
    },
  ];
  await expect(
    administerGroup('user', 'group', 5, 'admin', { action: 'rotate', hours: 168 }),
  ).rejects.toThrow(/pending/);
  expect(mockRpc).not.toHaveBeenCalled();
  mockRows.operations = [];
  mockRpc.mockResolvedValue({
    data: {
      snapshot: { ...snapshot, revision: 6, inviteCode: 'rotated' },
      access: [],
      revision: 6,
    },
    error: null,
  });
  await administerGroup('user', 'group', 5, 'admin', { action: 'rotate', hours: 168 });
  expect(mockRpc).toHaveBeenCalledWith(
    'rotate_group_invite',
    expect.objectContaining({
      p_expected_user_id: 'user',
      p_expected_revision: 5,
      p_operation_id: 'admin',
    }),
  );
  expect(mockWriteLedger.mock.calls[0]?.[1].revision).toBe(6);
});

test('acknowledged leave atomically removes only that account cache and records stale-access protection', async () => {
  mockRows.groups = [
    { ...snapshot, ownerId: 'other', syncUserId: 'user', syncStatus: 'synced', revision: 5 },
  ];
  mockRows.operations = [];
  mockRpc.mockResolvedValue({ data: { snapshot: null, access: [], revision: 6 }, error: null });
  await administerGroup('user', 'group', 5, 'leave', { action: 'leave', acknowledgeLedger: true });
  expect(mockRows.groups).toEqual([]);
  expect(mockRows.tombstones).toEqual([
    expect.objectContaining({ userId: 'user', groupId: 'group', revision: 6 }),
  ]);
});

test('edits queued during upload are individually acknowledged and never marked synced early', async () => {
  mockRpc
    .mockImplementationOnce(async (_name, args) => {
      expect(args.p_operation_id).toBe('op1');
      mockRows.operations.push(operation('op2', 2));
      return { data: { revision: 1, inviteCode: 'invite' }, error: null };
    })
    .mockImplementationOnce(async (_name, args) => {
      expect(args.p_operation_id).toBe('op2');
      expect(args.p_base_revision).toBe(1);
      expect(mockRows.groups[0]?.syncStatus).toBe('pending');
      return { data: { revision: 2, inviteCode: 'invite' }, error: null };
    });
  await expect(syncGroupSnapshot('user', 'group')).resolves.toBe('invite');
  expect(mockRows.operations).toHaveLength(0);
  expect(mockRows.groups[0]).toMatchObject({ revision: 2, syncStatus: 'synced' });
});

test('a lost acknowledgement retains the same operation ID for an idempotent retry', async () => {
  mockRpc
    .mockResolvedValueOnce({ data: null, error: { message: 'Network unavailable' } })
    .mockResolvedValueOnce({ data: { revision: 1, inviteCode: 'invite' }, error: null });
  await expect(syncGroupSnapshot('user', 'group')).rejects.toThrow('Network unavailable');
  expect(mockRows.operations).toHaveLength(1);
  await syncGroupSnapshot('user', 'group');
  expect(mockRpc.mock.calls.map(([, args]) => args.p_operation_id)).toEqual(['op1', 'op1']);
});

test('revision conflicts retain pending operations and pause automatic uploading', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'REVISION_CONFLICT' } });
  await expect(syncGroupSnapshot('user', 'group')).rejects.toThrow('REVISION_CONFLICT');
  expect(mockRows.operations).toHaveLength(1);
  expect(mockRows.groups[0]?.syncStatus).toBe('conflict');
  await expect(syncGroupSnapshot('user', 'group')).rejects.toThrow(/shared group changed/i);
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

test('account changes and local-only groups never upload another account snapshot', async () => {
  mockUserId = 'other';
  await expect(syncGroupSnapshot('user', 'group')).rejects.toThrow(/account changed/);
  expect(mockRpc).not.toHaveBeenCalled();
  mockRows.groups[0]!.syncUserId = null;
  await expect(syncGroupSnapshot('user', 'group')).rejects.toThrow(/different account/);
  expect(mockRpc).not.toHaveBeenCalled();
});

test('a stale fetch cannot replace a newer acknowledged local cache', async () => {
  mockRows.groups[0] = { id: 'group', syncUserId: 'user', syncStatus: 'synced', revision: 4 };
  await cacheRemoteGroups([{ ...snapshot, revision: 3, inviteCode: 'invite' }], 'user');
  expect(mockWriteLedger).not.toHaveBeenCalled();
});

test('a fetch begun before creation cannot falsely revoke an acknowledged pending group', async () => {
  mockRows.groups[0]!.inviteCode = 'invite';
  mockRpc.mockResolvedValue({
    data: [{ ...snapshot, revision: 1, inviteCode: 'invite' }],
    error: null,
  });
  await cacheRemoteGroups([], 'user');
  expect(mockRows.groups[0]?.syncStatus).toBe('pending');
  expect(mockRows.operations).toHaveLength(1);
});

test('confirmed access loss retains pending operations and exposes a conflict', async () => {
  mockRows.groups[0]!.inviteCode = 'invite';
  mockRpc.mockResolvedValue({ data: [], error: null });
  await cacheRemoteGroups([], 'user');
  expect(mockRows.groups[0]?.syncStatus).toBe('conflict');
  expect(mockRows.operations).toHaveLength(1);
});

test('another account pending cache cannot be silently reassigned by a remote refresh', async () => {
  mockRows.groups[0]!.syncUserId = 'other';
  await expect(cacheRemoteGroups([{ ...snapshot, inviteCode: 'invite' }], 'user')).rejects.toThrow(
    /another account/,
  );
  expect(mockRows.groups[0]?.syncUserId).toBe('other');
  expect(mockWriteLedger).not.toHaveBeenCalled();
});

test('account switching preserves private receipt metadata without showing another account’s files', async () => {
  mockRows.groups[0] = { id: 'group', syncUserId: 'other', syncStatus: 'synced', revision: 1 };
  mockRows.expenses = [
    {
      id: 'expense',
      groupId: 'group',
      receipts: {
        other: ['file:///other-private.jpg'],
        user: ['file:///my-private.jpg'],
      },
    },
  ];
  const members = ['a', 'b'].map((id) => ({
    id,
    groupId: 'group',
    name: id,
    createdAt: snapshot.createdAt,
    userId: null,
    deactivatedAt: null,
  }));
  await cacheRemoteGroups(
    [
      {
        ...snapshot,
        inviteCode: 'invite',
        revision: 2,
        members,
        expenses: [
          {
            id: 'expense',
            description: 'Dinner',
            amount: 1,
            paidBy: 'a',
            contributions: { a: 1 },
            split: { b: 1 },
            currency: 'INR',
            date: '2026-11-23',
            kind: 'expense',
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.createdAt,
            authorId: 'other',
            revision: 1,
            deletedAt: null,
            category: 'food',
            notes: '',
            method: '',
            reference: '',
            splitInputs: null,
            itemized: null,
            conversion: null,
          },
        ],
      },
    ],
    'user',
  );
  const [, group, receiptMaps] = mockWriteLedger.mock.calls[0]!;
  expect(group.expenses[0].receipts).toEqual(['file:///my-private.jpg']);
  expect(receiptMaps.expense.other).toEqual(['file:///other-private.jpg']);
});

test('durable operation snapshots never include device receipt URIs or account-local mapping', () => {
  const local: GroupWithDetails = {
    ...snapshot,
    syncUserId: 'user',
    syncStatus: 'pending',
    inviteCode: 'invite',
    localRevision: 1,
    meMemberId: 'a',
    conflictMessage: null,
    expenses: [{ id: 'expense', receipts: ['file:///private-device-receipt.jpg'] } as GroupExpense],
  };
  const queued = toLedger(local);
  expect(JSON.stringify(queued)).not.toContain('private-device-receipt.jpg');
  expect(queued.expenses[0]).not.toHaveProperty('receipts');
  expect(queued).not.toHaveProperty('meMemberId');
  expect(queued).not.toHaveProperty('syncUserId');
});
