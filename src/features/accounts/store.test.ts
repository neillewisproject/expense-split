import { accounts } from './data/schema';
import { expenses } from '@/features/expenses/data/schema';
import { groupCashMovements } from '@/features/group-cash/data/schema';
import { recurringDrafts, recurringRules } from '@/features/recurrence/data/schema';
import { usePersonalStore } from './store';

let mockDraft: { id: string; date: string; status: string; template: string } | undefined;
let mockRule: Record<string, unknown> | undefined;
let mockPosted: Record<string, unknown> | undefined;
let mockExpenseRows: Record<string, unknown>[] = [];
let mockCashRows: Record<string, unknown>[] = [];
const mockReloadExpenses = jest.fn().mockResolvedValue(undefined);
const mockInsert = (table: unknown) => ({
  values: (value: Record<string, unknown>) => {
    if (table === recurringRules) mockRule = value;
    return Object.assign(Promise.resolve(), {
      run: () => {
        if (table === expenses) mockPosted = value;
      },
    });
  },
});
const mockUpdate = () => ({ set: () => ({ where: () => ({ run: () => undefined }) }) });
const mockDb = {
  select: () => ({
    from: (table: unknown) => {
      const rows =
        table === recurringDrafts && mockDraft
          ? [mockDraft]
          : table === expenses
            ? mockExpenseRows
            : table === groupCashMovements
              ? mockCashRows
              : [];
      if (
        table !== recurringDrafts &&
        table !== accounts &&
        table !== expenses &&
        table !== groupCashMovements
      )
        throw new Error('Unexpected test query');
      return Object.assign(Promise.resolve(rows), { where: () => Promise.resolve(rows) });
    },
  }),
  insert: mockInsert,
  update: mockUpdate,
  transaction: (work: (tx: { insert: typeof mockInsert; update: typeof mockUpdate }) => void) =>
    work({ insert: mockInsert, update: mockUpdate }),
};

jest.mock('@/features/expenses/data/database', () => ({
  getExpenseDatabase: async () => mockDb,
}));
jest.mock('@/features/expenses/store', () => ({
  useExpensesStore: { getState: () => ({ loadExpenses: mockReloadExpenses }) },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-rule' }));

beforeEach(() => {
  mockRule = undefined;
  mockPosted = undefined;
  mockDraft = undefined;
  mockExpenseRows = [];
  mockCashRows = [];
  mockReloadExpenses.mockClear();
  usePersonalStore.setState({ load: async () => undefined });
});
it('rejects bulk trash of a transaction with an active group cash match', async () => {
  mockExpenseRows = [
    {
      id: 'personal',
      description: 'Meal',
      amount: 500,
      category: 'food',
      date: '2026-03-01',
      accountId: 'cash',
      receiptUri: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
  ];
  mockCashRows = [{ personalEntryId: 'personal', voidedAt: null }];
  await expect(
    usePersonalStore.getState().bulkChange(['personal'], { type: 'trash' }),
  ).rejects.toThrow('Void');
  expect(mockReloadExpenses).not.toHaveBeenCalled();
});

it('does not copy local receipt files into new schedules or approve old drafts with them', async () => {
  const entry = {
    description: 'Lunch',
    amount: 100,
    category: 'food' as const,
    date: '2026-03-01',
    receiptUri: 'file:///one.jpg',
    receiptUris: '["file:///one.jpg","file:///two.jpg"]',
  };
  await usePersonalStore
    .getState()
    .addRule(entry, 'monthly', '2026-03-01', 1, '2026-06-01', 'Asia/Kolkata');
  expect(mockRule).toMatchObject({
    endDate: '2026-06-01',
    timeZone: 'Asia/Kolkata',
  });
  expect(JSON.parse(String(mockRule?.template))).toMatchObject({
    receiptUri: null,
    receiptUris: '[]',
  });

  mockDraft = {
    id: 'old:2026-03-01',
    date: '2026-03-01',
    status: 'pending',
    template: JSON.stringify(entry),
  };
  await usePersonalStore.getState().decideDraft(mockDraft.id, true);
  expect(mockPosted).toMatchObject({
    id: 'recurring:old:2026-03-01',
    receiptUri: null,
    receiptUris: '[]',
  });
});

it('rejects invalid time zones and end dates before persisting a schedule', async () => {
  const entry = {
    description: 'Lunch',
    amount: 100,
    category: 'food' as const,
    date: '2026-03-01',
    receiptUri: null,
  };
  await expect(
    usePersonalStore
      .getState()
      .addRule(entry, 'monthly', '2026-03-01', 1, '2026-02-28', 'Asia/Kolkata'),
  ).rejects.toThrow('end date');
  await expect(
    usePersonalStore.getState().addRule(entry, 'monthly', '2026-03-01', 1, null, 'invalid/zone'),
  ).rejects.toThrow('IANA time zone');
  expect(mockRule).toBeUndefined();
});
