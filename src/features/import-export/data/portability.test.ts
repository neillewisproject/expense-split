import { getTableName, type Table } from 'drizzle-orm';
import { accounts } from '@/features/accounts/data/schema';
import { budgets } from '@/features/budgets/data/schema';
import { expenses } from '@/features/expenses/data/schema';
import { groupCashMovements } from '@/features/group-cash/data/schema';
import { recurringDrafts, recurringRules } from '@/features/recurrence/data/schema';
import { personalSettings } from '@/features/settings/data/schema';
import { createBackup, restoreBackup } from './portability';
import { portableEntry } from '../domain/portability';

type Row = Record<string, unknown>;
let mockRows: Record<string, Row[]>;
const mockReload = jest.fn(async () => {});

jest.mock('@/features/accounts/store', () => ({
  usePersonalStore: { getState: () => ({ load: mockReload }) },
}));
jest.mock('@/features/expenses/store', () => ({
  useExpensesStore: { getState: () => ({ loadExpenses: mockReload }) },
}));
jest.mock('@/features/group-cash/store', () => ({
  useGroupCashStore: { getState: () => ({ load: mockReload }) },
}));
jest.mock('@/features/recurrence/data/reminder-state', () => ({
  cancelAllPersonalReminders: async () => {},
}));
jest.mock('@/features/expenses/data/receipt-files', () => ({
  deleteReceiptFile: jest.fn(),
}));
const mockDb = {
  select: () => ({ from: async (table: Table) => mockRows[getTableName(table)] ?? [] }),
  transaction: (
    work: (tx: {
      delete: (table: Table) => { run: () => void };
      insert: (table: Table) => { values: (row: Row) => { run: () => void } };
    }) => void,
  ) => {
    const next = structuredClone(mockRows);
    work({
      delete: (table) => ({
        run: () => {
          next[getTableName(table)] = [];
        },
      }),
      insert: (table) => ({
        values: (row) => ({
          run: () => {
            if (row.id === 'fail') throw new Error('Simulated database failure');
            next[getTableName(table)]!.push(row);
          },
        }),
      }),
    });
    mockRows = next;
  },
};
jest.mock('@/features/expenses/data/database', () => ({ getExpenseDatabase: async () => mockDb }));

beforeEach(() => {
  const now = '2026-03-01T00:00:00.000Z';
  mockRows = {};
  for (const table of [
    accounts,
    budgets,
    expenses,
    groupCashMovements,
    recurringDrafts,
    recurringRules,
    personalSettings,
  ])
    mockRows[getTableName(table)] = [];
  mockRows[getTableName(accounts)] = [
    {
      id: 'cash',
      name: 'Cash',
      currency: 'INR',
      openingBalance: 1000,
      archived: false,
      createdAt: now,
    },
  ];
  mockRows[getTableName(groupCashMovements)] = [
    {
      id: 'movement',
      groupId: 'trip',
      expenseId: 'meal',
      memberId: 'me',
      groupUserId: 'signed-in-user',
      accountId: 'cash',
      personalEntryId: null,
      currency: 'INR',
      amount: 200,
      direction: 'out',
      date: '2026-03-01',
      description: 'Meal',
      groupName: 'Trip',
      expenseRevision: 1,
      createdAt: now,
      voidedAt: null,
    },
  ];
  mockRows[getTableName(personalSettings)] = [
    { id: 'personal', defaultCurrency: 'INR', categories: '[]' },
  ];
  mockRows.groups = [{ id: 'trip' }];
  mockReload.mockClear();
});

it('round-trips group cash and restores older backups without changing group ledgers', async () => {
  const backup = await createBackup();
  expect(JSON.parse(backup).cashMovements[0]).not.toHaveProperty('groupUserId');
  mockRows[getTableName(groupCashMovements)] = [];
  await restoreBackup(backup);
  expect(mockRows[getTableName(groupCashMovements)]).toMatchObject([
    { id: 'movement', amount: 200, groupUserId: null },
  ]);
  expect(mockRows.groups).toEqual([{ id: 'trip' }]);
  expect(mockReload).toHaveBeenCalledTimes(3);
  const old = JSON.parse(backup) as Record<string, unknown>;
  old.version = 3;
  delete old.cashMovements;
  await restoreBackup(JSON.stringify(old));
  expect(mockRows[getTableName(groupCashMovements)]).toEqual([]);
  expect(mockRows.groups).toEqual([{ id: 'trip' }]);
});

it('keeps existing data when a restore transaction fails', async () => {
  const backup = JSON.parse(await createBackup()) as { cashMovements: Row[] };
  backup.cashMovements[0]!.id = 'fail';
  const before = structuredClone(mockRows);
  await expect(restoreBackup(JSON.stringify(backup))).rejects.toThrow('Simulated database failure');
  expect(mockRows).toEqual(before);
  expect(mockReload).not.toHaveBeenCalled();
});
it('round-trips an active personal transaction match', async () => {
  const now = '2026-03-01T00:00:00.000Z';
  mockRows[getTableName(expenses)] = [
    portableEntry({
      id: 'existing',
      description: 'Meal',
      amount: 200,
      category: 'food',
      date: '2026-03-01',
      accountId: 'cash',
      receiptUri: null,
      createdAt: now,
      updatedAt: now,
    }),
  ];
  mockRows[getTableName(groupCashMovements)]![0]!.personalEntryId = 'existing';
  const backup = await createBackup();
  mockRows[getTableName(groupCashMovements)] = [];
  await restoreBackup(backup);
  expect(mockRows[getTableName(groupCashMovements)]).toMatchObject([
    { personalEntryId: 'existing' },
  ]);
});
it('round-trips categorization rules with private settings', async () => {
  const rules = [{ id: 'rule', contains: 'train', entryType: 'expense', category: 'transport' }];
  mockRows[getTableName(personalSettings)]![0]!.categoryRules = JSON.stringify(rules);
  const backup = await createBackup();
  mockRows[getTableName(personalSettings)] = [];
  await restoreBackup(backup);
  expect(mockRows[getTableName(personalSettings)]).toMatchObject([
    { categoryRules: JSON.stringify(rules) },
  ]);
});
it('round-trips a combined budget without requiring the group ledger in the backup', async () => {
  mockRows[getTableName(budgets)] = [
    {
      id: 'budget',
      name: 'Group food',
      month: '2026-03',
      currency: 'INR',
      amount: 10000,
      category: null,
      accountId: null,
      tag: null,
      threshold: 80,
      carryoverFromId: null,
      basis: 'combined',
    },
  ];
  const backup = await createBackup();
  mockRows[getTableName(budgets)] = [];
  await restoreBackup(backup);
  expect(mockRows[getTableName(budgets)]).toMatchObject([{ id: 'budget', basis: 'combined' }]);
  expect(mockRows.groups).toEqual([{ id: 'trip' }]);
});
