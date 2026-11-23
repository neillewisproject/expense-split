import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { View as mockView } from 'react-native';
import { BudgetsScreen } from './budgets-screen';

const mockLoad = jest.fn().mockResolvedValue(undefined);
const mockSave = jest.fn().mockResolvedValue(undefined);
let mockGroupStatus: 'ready' | 'error';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: mockView }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/features/accounts/store', () => ({
  usePersonalStore: (
    select: (state: {
      budgets: {
        id: string;
        name: string;
        month: string;
        currency: string;
        amount: number;
        category: null;
        accountId: null;
        tag: null;
        threshold: number;
        basis: 'combined';
      }[];
      accounts: never[];
      categories: never[];
      load: typeof mockLoad;
      saveBudget: typeof mockSave;
      deleteBudget: typeof mockLoad;
      error: null;
    }) => unknown,
  ) =>
    select({
      budgets: [
        {
          id: 'existing',
          name: 'Group food',
          month: '2026-03',
          currency: 'INR',
          amount: 10000,
          category: null,
          accountId: null,
          tag: null,
          threshold: 80,
          basis: 'combined',
        },
      ],
      accounts: [],
      categories: [],
      load: mockLoad,
      saveBudget: mockSave,
      deleteBudget: mockLoad,
      error: null,
    }),
}));
jest.mock('@/features/expenses/store', () => ({
  useExpensesStore: (
    select: (state: {
      expenses: never[];
      status: 'ready';
      error: null;
      loadExpenses: typeof mockLoad;
    }) => unknown,
  ) => select({ expenses: [], status: 'ready', error: null, loadExpenses: mockLoad }),
}));
jest.mock('@/features/groups/store', () => ({
  useGroupsStore: (
    select: (state: {
      groups: never[];
      status: 'ready' | 'error';
      activeUserId: null;
      error: string | null;
      loadGroups: typeof mockLoad;
    }) => unknown,
  ) =>
    select({
      groups: [],
      status: mockGroupStatus,
      activeUserId: null,
      error: mockGroupStatus === 'error' ? 'Cannot load groups' : null,
      loadGroups: mockLoad,
    }),
}));
jest.mock('@/features/group-cash/store', () => ({
  useGroupCashStore: (
    select: (state: {
      movements: never[];
      loaded: boolean;
      error: null;
      load: typeof mockLoad;
    }) => unknown,
  ) => select({ movements: [], loaded: true, error: null, load: mockLoad }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGroupStatus = 'ready';
});

it('allows an explicit combined budget without unsupported account or tag filters', async () => {
  await render(<BudgetsScreen />);
  await fireEvent.press(screen.getByRole('radio', { name: /Personal \+ own group shares/ }));
  expect(screen.queryByLabelText('Tag filter (optional)')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Budget name'), 'Trip');
  await fireEvent.changeText(screen.getByLabelText('Month (YYYY-MM)'), '2026-03');
  await fireEvent.changeText(screen.getByLabelText('Limit'), '100');
  await fireEvent.press(screen.getByRole('button', { name: 'Create monthly budget' }));
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Trip', basis: 'combined', accountId: null, tag: null }),
    ),
  );
});

it('does not present combined totals while group data has failed to load', async () => {
  mockGroupStatus = 'error';
  await render(<BudgetsScreen />);
  expect(screen.getByText(/Group data or cash matches are unavailable/)).toBeTruthy();
});
