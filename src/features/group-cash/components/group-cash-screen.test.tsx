import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, View as mockView } from 'react-native';
import type { GroupWithDetails } from '@/features/groups/domain/group';
import { GroupCashScreen } from './group-cash-screen';

const mockLoad = jest.fn().mockResolvedValue(undefined);
const mockRecord = jest.fn().mockResolvedValue(undefined);
const mockBack = jest.fn();
let mockGroup: GroupWithDetails;
const mockNow = '2026-03-01T00:00:00.000Z';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: mockView }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'group', expenseId: 'meal' }),
  router: { back: () => mockBack() },
}));
jest.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/features/groups/store', () => ({
  useGroupsStore: (
    select: (state: {
      groups: GroupWithDetails[];
      activeUserId: null;
      loadGroups: typeof mockLoad;
      error: null;
    }) => unknown,
  ) => select({ groups: [mockGroup], activeUserId: null, loadGroups: mockLoad, error: null }),
}));
jest.mock('@/features/accounts/store', () => ({
  usePersonalStore: (
    select: (state: {
      accounts: { id: string; name: string; currency: string; archived: boolean }[];
      load: typeof mockLoad;
      error: null;
    }) => unknown,
  ) =>
    select({
      accounts: [{ id: 'cash', name: 'Cash', currency: 'INR', archived: false }],
      load: mockLoad,
      error: null,
    }),
}));
jest.mock('@/features/expenses/store', () => ({
  useExpensesStore: (
    select: (state: {
      expenses: {
        id: string;
        description: string;
        amount: number;
        accountId: string;
        date: string;
      }[];
      status: 'ready';
      error: null;
      loadExpenses: typeof mockLoad;
    }) => unknown,
  ) =>
    select({
      expenses: [
        {
          id: 'existing',
          description: 'Existing payment',
          amount: 500,
          accountId: 'cash',
          date: '2026-03-01',
        },
        {
          id: 'wrong',
          description: 'Wrong amount',
          amount: 499,
          accountId: 'cash',
          date: '2026-03-01',
        },
      ],
      status: 'ready',
      error: null,
      loadExpenses: mockLoad,
    }),
}));
jest.mock('../store', () => ({
  useGroupCashStore: (
    select: (state: {
      movements: never[];
      error: null;
      loaded: boolean;
      load: typeof mockLoad;
      record: typeof mockRecord;
    }) => unknown,
  ) => select({ movements: [], error: null, loaded: true, load: mockLoad, record: mockRecord }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGroup = {
    id: 'group',
    name: 'Trip',
    currency: 'INR',
    ownerId: null,
    revision: 1,
    localRevision: 1,
    archivedAt: null,
    createdAt: mockNow,
    syncUserId: null,
    syncStatus: 'local',
    inviteCode: null,
    conflictMessage: null,
    meMemberId: 'me',
    activity: [],
    members: [
      {
        id: 'me',
        groupId: 'group',
        name: 'Me',
        createdAt: mockNow,
        deactivatedAt: null,
        userId: null,
      },
    ],
    expenses: [
      {
        id: 'meal',
        description: 'Meal',
        amount: 500,
        currency: 'INR',
        date: '2026-03-01',
        createdAt: mockNow,
        updatedAt: mockNow,
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
});

it('requires an explicit eligible match and confirmation without changing the balance twice', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<GroupCashScreen />);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Cash' }));
  await fireEvent.press(
    screen.getByRole('checkbox', { name: 'Match an existing personal transaction' }),
  );
  expect(screen.queryByText(/Wrong amount/)).toBeNull();
  const review = screen.getByRole('button', { name: 'Review and match transaction' });
  expect(review).toHaveProp('accessibilityState', { disabled: true });
  await fireEvent.press(screen.getByRole('checkbox', { name: /Existing payment/ }));
  await fireEvent.press(review);
  expect(alert).toHaveBeenCalledWith(
    'Record this cash movement?',
    expect.stringContaining('without changing your account balance'),
    expect.any(Array),
  );
  expect(mockRecord).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0]?.[2];
  await buttons?.find((button) => button.text === 'Record')?.onPress?.();
  await waitFor(() =>
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ expenseId: 'meal', amount: 500 }),
      'cash',
      null,
      'existing',
    ),
  );
  alert.mockRestore();
});
