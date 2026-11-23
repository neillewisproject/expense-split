import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { View as mockView } from 'react-native';
import type { GroupExpense, GroupWithDetails } from '../domain/group';
import { GroupExpenseEditor } from './group-expense-editor';
import { GroupRefundEditor } from './group-refund-editor';

let mockParams: Record<string, string> = { id: 'group' };
const mockAdd = jest.fn();
const mockEdit = jest.fn();
const mockBack = jest.fn();
const mockRefund = jest.fn();
let mockGroup: GroupWithDetails;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { back: () => mockBack() },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'submission-id' }));
jest.mock('@/features/receipts/components/receipt-picker', () => ({ ReceiptPicker: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: mockView,
}));
jest.mock('../store', () => {
  const state = () => ({
    groups: [mockGroup],
    activeUserId: 'member',
    addGroupExpense: mockAdd,
    editGroupExpense: mockEdit,
    recordGroupRefund: mockRefund,
  });
  return {
    useGroupsStore: Object.assign((selector: (value: unknown) => unknown) => selector(state()), {
      getState: state,
    }),
  };
});

beforeEach(() => {
  mockParams = { id: 'group' };
  mockAdd.mockReset().mockResolvedValue(undefined);
  mockEdit.mockReset().mockResolvedValue(undefined);
  mockBack.mockClear();
  mockRefund.mockReset().mockResolvedValue(undefined);
  mockGroup = {
    id: 'group',
    name: 'Trip',
    currency: 'INR',
    ownerId: 'owner',
    revision: 0,
    localRevision: 0,
    createdAt: '2026-11-23T00:00:00.000Z',
    archivedAt: null,
    syncUserId: 'member',
    syncStatus: 'synced',
    inviteCode: 'invite',
    meMemberId: null,
    conflictMessage: null,
    expenses: [],
    activity: [],
    members: ['Alice', 'Bob', 'Casey'].map((name, index) => ({
      id: ['a', 'b', 'c'][index]!,
      groupId: 'group',
      name,
      createdAt: '2026-11-23T00:00:00.000Z',
      deactivatedAt: null,
      userId: null,
    })),
  };
});

test('linked refund form uses full remaining original units and accepts a capped partial amount', async () => {
  mockGroup.expenses = [
    {
      id: 'original',
      description: 'Dinner',
      amount: 10000,
      paidBy: 'a',
      contributions: { a: 10000 },
      split: { a: 7000, b: 3000 },
      currency: 'INR',
      date: '2026-11-23',
      kind: 'expense',
      category: 'food',
      notes: '',
      method: '',
      reference: '',
      authorId: 'member',
      createdAt: '2026-11-23T00:00:00.000Z',
      updatedAt: '2026-11-23T00:00:00.000Z',
      revision: 1,
      deletedAt: null,
      splitInputs: null,
      itemized: null,
      conversion: null,
      receipts: [],
    },
  ];
  mockParams.originalId = 'original';
  await render(<GroupRefundEditor />);
  await fireEvent.press(screen.getByRole('button', { name: 'Refund full remaining amount' }));
  expect(screen.getByLabelText('Refund amount (INR)').props.value).toBe('100.00');
  await fireEvent.changeText(screen.getByLabelText('Refund amount (INR)'), '25.00');
  await fireEvent.changeText(screen.getByLabelText('Refund notes'), 'Partial return');
  await fireEvent.press(screen.getByRole('button', { name: 'Save linked refund' }));
  await waitFor(() =>
    expect(mockRefund).toHaveBeenCalledWith(
      'group',
      'original',
      expect.objectContaining({ sourceAmount: 2500, notes: 'Partial return' }),
      undefined,
      'submission-id',
    ),
  );
  expect(mockBack).toHaveBeenCalledTimes(1);
});

test('the form posts a selected equal subset with two payers and saves original inputs', async () => {
  await render(<GroupExpenseEditor />);
  await fireEvent.changeText(screen.getByLabelText('Description'), 'Dinner');
  await fireEvent.changeText(screen.getByLabelText('Amount (INR)'), '100.01');
  await fireEvent.changeText(screen.getByLabelText('Date (YYYY-MM-DD)'), '2026-11-23');
  await fireEvent.press(screen.getAllByRole('checkbox', { name: 'Casey' })[1]!);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Multiple payers' }));
  await fireEvent.changeText(screen.getByLabelText('Alice paid (INR)'), '30.00');
  await fireEvent.changeText(screen.getByLabelText('Casey paid (INR)'), '70.01');
  await fireEvent.press(screen.getByRole('button', { name: 'Save entry' }));
  await waitFor(() =>
    expect(mockAdd).toHaveBeenCalledWith(
      'group',
      expect.objectContaining({
        amount: 10001,
        split: { a: 5001, b: 5000 },
        contributions: { a: 3000, b: 0, c: 7001 },
        splitInputs: { mode: 'equally', memberIds: ['a', 'b'], values: {} },
      }),
      'submission-id',
    ),
  );
  expect(mockBack).toHaveBeenCalledTimes(1);
});

test('editing restores saved exact amounts, notes and local-only receipt metadata', async () => {
  const existing: GroupExpense = {
    id: 'expense',
    description: 'Dinner',
    amount: 10000,
    paidBy: 'a',
    contributions: { a: 10000 },
    split: { a: 7000, b: 3000 },
    currency: 'INR',
    date: '2026-11-23',
    kind: 'expense',
    category: 'food',
    notes: 'Original note',
    method: '',
    reference: '',
    authorId: 'member',
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    revision: 1,
    deletedAt: null,
    splitInputs: { mode: 'exact', memberIds: ['a', 'b'], values: { a: 7000, b: 3000 } },
    itemized: null,
    conversion: null,
    receipts: ['file:///local-receipt.jpg'],
  };
  mockGroup.expenses = [existing];
  mockParams.expenseId = 'expense';
  await render(<GroupExpenseEditor />);
  expect(screen.getByLabelText('Alice exact').props.value).toBe('70.00');
  expect(screen.getByLabelText('Bob exact').props.value).toBe('30.00');
  await fireEvent.changeText(screen.getByLabelText('Notes'), 'Corrected note');
  await fireEvent.press(screen.getByRole('button', { name: 'Save entry' }));
  await waitFor(() =>
    expect(mockEdit).toHaveBeenCalledWith(
      'group',
      'expense',
      expect.objectContaining({
        split: { a: 7000, b: 3000 },
        notes: 'Corrected note',
        category: 'food',
        receipts: ['file:///local-receipt.jpg'],
      }),
    ),
  );
});

test('custom settlement presets allow a partial payment without executing money movement', async () => {
  mockParams = { id: 'group', from: 'a', to: 'b', amount: '20.00' };
  await render(<GroupExpenseEditor settlement />);
  await fireEvent.changeText(screen.getByLabelText('Amount (INR)'), '12.34');
  await fireEvent.changeText(screen.getByLabelText('Payment method'), 'Cash');
  await fireEvent.press(screen.getByRole('button', { name: 'Save entry' }));
  await waitFor(() =>
    expect(mockAdd).toHaveBeenCalledWith(
      'group',
      expect.objectContaining({
        amount: 1234,
        paidBy: 'a',
        split: { b: 1234 },
        contributions: { a: 1234 },
        kind: 'settlement',
        splitInputs: null,
        method: 'Cash',
      }),
      'submission-id',
    ),
  );
});
