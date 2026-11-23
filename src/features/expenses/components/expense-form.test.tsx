import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { createDefaultExpenseValues, ExpenseForm } from './expense-form';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));
jest.mock('@/features/expenses/data/receipt-files', () => ({ persistReceiptFile: jest.fn() }));

describe('ExpenseForm', () => {
  it('shows validation errors and does not submit incomplete expenses', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await render(
      <ExpenseForm
        initialValues={createDefaultExpenseValues()}
        onSave={onSave}
        saveError={null}
        submitLabel="Save expense"
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));

    expect(screen.getByText('Enter a description')).toBeTruthy();
    expect(
      screen.getByText('Enter an amount greater than zero with up to 2 decimal places'),
    ).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps multiple selected receipts until save and lets the user remove one', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///receipt.jpg',
          width: 1200,
          height: 900,
          type: 'image',
          fileName: 'receipt.jpg',
          fileSize: 1024,
          assetId: null,
          base64: null,
          duration: null,
          exif: null,
        },
        {
          uri: 'file:///second.jpg',
          width: 1200,
          height: 900,
        },
      ],
    });

    const onSave = jest.fn().mockResolvedValue(undefined);
    await render(
      <ExpenseForm
        initialValues={{
          ...createDefaultExpenseValues(),
          description: 'Meal',
          amount: '20',
        }}
        onSave={onSave}
        saveError={null}
        submitLabel="Save expense"
      />,
    );

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Choose receipt photos' }));
    });
    expect(await screen.findByRole('button', { name: 'Remove receipt 2' })).toBeTruthy();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'], allowsMultipleSelection: true }),
    );

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Remove receipt 1' }));
    });
    expect(screen.queryByRole('button', { name: 'Remove receipt 2' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));
    expect(onSave).toHaveBeenCalledWith(expect.any(Object), ['file:///second.jpg']);
  });

  it('posts positive income in a three-decimal currency', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await render(
      <ExpenseForm
        initialValues={{
          description: 'Salary',
          amount: '12.345',
          category: 'other',
          date: '2026-03-15',
          currency: 'KWD',
          entryType: 'income',
        }}
        onSave={onSave}
        saveError={null}
        submitLabel="Save income"
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save income' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '12.345', currency: 'KWD', entryType: 'income' }),
      [],
    );
  });

  it('requires two accounts before posting a transfer', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await render(
      <ExpenseForm
        initialValues={{
          description: 'Move cash',
          amount: '20',
          category: 'other',
          date: '2026-03-15',
          entryType: 'transfer',
        }}
        onSave={onSave}
        saveError={null}
        submitLabel="Save transfer"
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save transfer' }));
    expect(await screen.findByText('Choose two different accounts for a transfer')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('uses category rules only after explicit acceptance and preserves manual overrides', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await render(
      <ExpenseForm
        initialValues={{ ...createDefaultExpenseValues(), description: 'Train cafe', amount: '20' }}
        categoryRules={[
          { id: 'train', contains: 'train', entryType: 'expense', category: 'transport' },
        ]}
        onSave={onSave}
        saveError={null}
        submitLabel="Save expense"
      />,
    );
    expect(screen.getByRole('radio', { name: 'Other' })).toHaveProp('accessibilityState', {
      checked: true,
    });
    await fireEvent.press(
      screen.getByRole('button', { name: 'Use suggested category: Transport' }),
    );
    expect(screen.getByRole('radio', { name: 'Transport' })).toHaveProp('accessibilityState', {
      checked: true,
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ category: 'food' }), []);
  });
});
