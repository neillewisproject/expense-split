import { fireEvent, render, screen } from '@testing-library/react-native';
import { restoreBackup } from '../data/portability';
import { portableEntry } from '../domain/portability';
import { PortabilityScreen } from './portability-screen';

const mockLoad = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/features/expenses/store', () => ({
  useExpensesStore: (
    selector: (state: { expenses: never[]; loadExpenses: typeof mockLoad }) => unknown,
  ) => selector({ expenses: [], loadExpenses: mockLoad }),
}));
jest.mock('@/features/accounts/store', () => ({
  usePersonalStore: (selector: (state: { accounts: never[]; load: typeof mockLoad }) => unknown) =>
    selector({ accounts: [], load: mockLoad }),
}));
jest.mock('../data/portability', () => ({
  createBackup: jest.fn(),
  createCsv: jest.fn(),
  importCsv: jest.fn(),
  restoreBackup: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../device-files', () => ({ pickTextFile: jest.fn(), shareTextFile: jest.fn() }));

const timestamp = '2026-03-01T00:00:00.000Z';
const backupText = JSON.stringify({
  format: 'expense-split-personal',
  version: 1,
  exportedAt: timestamp,
  omittedReceiptCount: 0,
  accounts: [],
  expenses: [
    portableEntry({
      id: 'meal',
      description: 'Meal',
      amount: 100,
      category: 'food',
      date: '2026-03-01',
      receiptUri: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  ],
  budgets: [],
  rules: [],
  drafts: [],
  settings: { defaultCurrency: 'INR', categories: [] },
});
beforeEach(() => jest.clearAllMocks());
it('requires validated preview and typed confirmation, and invalidates both after text changes', async () => {
  await render(<PortabilityScreen />);
  await fireEvent.press(screen.getByRole('radio', { name: /JSON backup/ }));
  await fireEvent.changeText(
    screen.getByLabelText('CSV / JSON text (paste or select file)'),
    backupText,
  );
  const restore = () => screen.getByRole('button', { name: 'Restore previewed personal backup' });
  expect(restore()).toHaveProp('accessibilityState', { disabled: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Validate and preview import' }));
  expect(await screen.findByText(/Replace personal data with 1 transactions/)).toBeTruthy();
  expect(screen.getByText(/Restoring any backup replaces existing group cash/)).toBeTruthy();
  expect(screen.getByText(/0 group cash movements/)).toBeTruthy();
  expect(restore()).toHaveProp('accessibilityState', { disabled: true });
  await fireEvent.changeText(
    screen.getByLabelText('Type REPLACE PERSONAL DATA to confirm replacement'),
    'REPLACE PERSONAL DATA',
  );
  expect(restore()).toHaveProp('accessibilityState', { disabled: false });
  await fireEvent.changeText(
    screen.getByLabelText('CSV / JSON text (paste or select file)'),
    `${backupText} `,
  );
  expect(restore()).toHaveProp('accessibilityState', { disabled: true });
  expect(restoreBackup).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Validate and preview import' }));
  await fireEvent.changeText(
    screen.getByLabelText('Type REPLACE PERSONAL DATA to confirm replacement'),
    'REPLACE PERSONAL DATA',
  );
  await fireEvent.press(restore());
  expect(restoreBackup).toHaveBeenCalledWith(`${backupText} `);
  expect(await screen.findByText(/Personal financial records restored/)).toBeTruthy();
});
