import { accounts } from '@/features/accounts/data/schema';
import { groupCashMovements, type GroupCashMovement } from '@/features/group-cash/data/schema';
import { expenses, type StoredExpense } from './data/schema';
import { useExpensesStore } from './store';

const mockNow = '2026-03-01T00:00:00.000Z';
let mockEntry: StoredExpense;
let mockMovement: GroupCashMovement;
const mockUpdate = jest.fn();
const mockDb = {
  select: () => ({
    from: (table: unknown) =>
      Promise.resolve(
        table === expenses
          ? [mockEntry]
          : table === accounts
            ? [
                {
                  id: 'cash',
                  name: 'Cash',
                  currency: 'INR',
                  openingBalance: 0,
                  archived: false,
                  createdAt: mockNow,
                },
              ]
            : table === groupCashMovements
              ? [mockMovement]
              : [],
      ),
  }),
  update: () => ({ set: (value: unknown) => ({ where: async () => mockUpdate(value) }) }),
};
jest.mock('./data/database', () => ({ getExpenseDatabase: async () => mockDb }));

beforeEach(() => {
  mockUpdate.mockClear();
  mockEntry = {
    id: 'personal',
    description: 'Meal',
    amount: 500,
    category: 'food',
    date: '2026-03-01',
    accountId: 'cash',
    receiptUri: null,
    createdAt: mockNow,
    updatedAt: mockNow,
  };
  mockMovement = {
    id: 'link',
    groupId: 'group',
    expenseId: 'meal',
    memberId: 'me',
    groupUserId: null,
    accountId: 'cash',
    personalEntryId: 'personal',
    currency: 'INR',
    amount: 500,
    direction: 'out',
    date: '2026-03-01',
    description: 'Meal',
    groupName: 'Trip',
    expenseRevision: 1,
    createdAt: mockNow,
    voidedAt: null,
  };
  useExpensesStore.setState({ loadExpenses: async () => {} });
});

it('blocks changing accounting fields or trashing a matched transaction until the match is voided', async () => {
  await expect(
    useExpensesStore.getState().saveExpense({ ...mockEntry, amount: 400 }, 'personal'),
  ).rejects.toThrow('Void');
  await expect(useExpensesStore.getState().deleteExpense('personal')).rejects.toThrow('Void');
  expect(mockUpdate).not.toHaveBeenCalled();
  await useExpensesStore.getState().saveExpense({ ...mockEntry, notes: 'Updated' }, 'personal');
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  mockMovement.voidedAt = mockNow;
  await useExpensesStore.getState().deleteExpense('personal');
  expect(mockUpdate).toHaveBeenCalledTimes(2);
});
