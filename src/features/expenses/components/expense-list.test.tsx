import { View as MockAnimatedView } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';
import type { StoredExpense } from '@/features/expenses/data/schema';
import { useTheme } from '@/hooks/use-theme';

import { ExpenseList } from './expense-list';

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-reanimated', () => {
  const transition = {
    duration: () => transition,
    springify: () => transition,
  };
  return {
    __esModule: true,
    default: { View: MockAnimatedView },
    FadeInDown: transition,
    FadeOutUp: transition,
    LinearTransition: transition,
  };
});

jest.mock('@/hooks/use-theme', () => ({
  useTheme: jest.fn(),
}));

describe('ExpenseList', () => {
  const expense: StoredExpense = {
    id: 'expense-1',
    description: 'Lunch',
    amount: 12550,
    category: 'food',
    date: '2026-03-15',
    receiptUri: null,
    createdAt: '2026-03-15T12:00:00.000Z',
    updatedAt: '2026-03-15T12:00:00.000Z',
  };

  beforeEach(() => {
    jest.mocked(useTheme).mockReturnValue(Colors.light);
  });

  it('renders expense description, category, amount and grouped day', async () => {
    const expenses: StoredExpense[] = [
      expense,
      { ...expense, id: 'expense-2', description: 'Coffee', amount: 450 },
      {
        ...expense,
        id: 'expense-3',
        description: 'Taxi',
        date: '2026-03-14',
        category: 'transport',
      },
    ];

    await render(<ExpenseList expenses={expenses} onDelete={jest.fn()} onSelect={jest.fn()} />);

    expect(screen.getByText('Lunch')).toBeTruthy();
    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.getByText('Taxi')).toBeTruthy();
    expect(screen.getAllByText('Food')).toHaveLength(2);
    expect(screen.getAllByText('₹125.50')).toHaveLength(2);
    expect(screen.getAllByText(/15 March/)).toHaveLength(1);
    expect(screen.getByText(/14 March/)).toBeTruthy();
  });

  it.each(['light', 'dark'] as const)(
    'covers the delete action with an opaque %s row and reserves space for the amount',
    async (mode) => {
      jest.mocked(useTheme).mockReturnValue(Colors[mode]);
      const longDescription = 'Lunch with friends and colleagues at a downtown restaurant';
      await render(
        <ExpenseList
          expenses={[{ ...expense, description: longDescription }]}
          onDelete={jest.fn()}
          onSelect={jest.fn()}
        />,
      );

      expect(screen.getByRole('button')).toHaveStyle({
        backgroundColor: Colors[mode].background,
      });
      expect(screen.getByText(longDescription)).toHaveProp('numberOfLines', 1);
      expect(screen.getByText('₹125.50')).toHaveStyle({ flexShrink: 0 });
    },
  );
});
