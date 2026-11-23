import { fireEvent, render, screen } from '@testing-library/react-native';
import { PersonalHome } from './personal-home';

const mockGenerate = jest.fn().mockResolvedValue(undefined);
const mockLoad = jest.fn().mockResolvedValue(undefined);
const mockBulk = jest.fn().mockResolvedValue(1);
const mockEntries = [
  {
    id: 'meal',
    description: 'Meal',
    amount: 100,
    category: 'food',
    date: '2026-03-01',
    receiptUri: null,
    tags: '[]',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'coffee',
    description: 'Coffee',
    amount: 50,
    category: 'food',
    date: '2026-03-01',
    receiptUri: null,
    tags: '[]',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
];
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('./expense-list', () => ({
  ExpenseList: () => null,
  TransactionRow: ({
    accessibilityLabel,
    checked,
    onPress,
  }: {
    accessibilityLabel: string;
    checked: boolean;
    onPress: () => void;
  }) => {
    const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked }}
        onPress={onPress}
      />
    );
  },
}));
jest.mock('@/features/recurrence/use-due-recurring', () => ({ useDueRecurring: () => null }));
jest.mock('@/features/expenses/store', () => ({
  useExpensesStore: (selector: (state: object) => unknown) =>
    selector({
      expenses: mockEntries,
      status: 'ready',
      error: null,
      loadExpenses: mockLoad,
      deleteExpense: mockLoad,
      restoreExpense: mockLoad,
    }),
}));
jest.mock('@/features/accounts/store', () => ({
  usePersonalStore: (selector: (state: object) => unknown) =>
    selector({
      accounts: [],
      categories: [],
      drafts: [],
      generateDue: mockGenerate,
      bulkChange: mockBulk,
    }),
}));
beforeEach(() => jest.clearAllMocks());
it('requires explicit selection, preview and confirmation before applying only selected bulk changes', async () => {
  await render(<PersonalHome />);
  await fireEvent.press(screen.getByRole('button', { name: 'Select for bulk actions' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Select Meal, 2026-03-01' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Bulk change 1 selected' }));
  await fireEvent.press(screen.getByRole('radio', { name: /Add tags/ }));
  await fireEvent.changeText(
    screen.getByLabelText('Bulk tags to add (comma separated)'),
    'holiday',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Review 1 selected changes' }));
  expect(screen.getByRole('button', { name: 'Apply confirmed bulk changes' })).toHaveProp(
    'accessibilityState',
    { disabled: true },
  );
  expect(mockBulk).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Type APPLY 1 to confirm'), 'APPLY 1');
  await fireEvent.changeText(
    screen.getByLabelText('Bulk tags to add (comma separated)'),
    'reviewed',
  );
  expect(screen.queryByRole('button', { name: 'Apply confirmed bulk changes' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Review 1 selected changes' }));
  await fireEvent.changeText(screen.getByLabelText('Type APPLY 1 to confirm'), 'APPLY 1');
  await fireEvent.press(screen.getByRole('button', { name: 'Apply confirmed bulk changes' }));
  expect(mockBulk).toHaveBeenCalledWith(['meal'], { type: 'tags', tags: 'reviewed' });
  expect(screen.getByRole('button', { name: 'Select for bulk actions' })).toBeTruthy();
});
