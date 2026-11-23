import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { createDefaultExpenseValues, ExpenseForm } from './expense-form';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

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

    fireEvent.press(screen.getByRole('button', { name: 'Save expense' }));

    expect(await screen.findByText('Enter a description')).toBeTruthy();
    expect(
      await screen.findByText('Enter an amount greater than zero with up to 2 decimal places'),
    ).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('lets the user select and remove a receipt photo', async () => {
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
      ],
    });

    await render(
      <ExpenseForm
        initialValues={createDefaultExpenseValues()}
        onSave={jest.fn().mockResolvedValue(undefined)}
        saveError={null}
        submitLabel="Save expense"
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Add receipt photo' }));
      await Promise.resolve();
    });
    expect(await screen.findByRole('button', { name: 'Change receipt photo' })).toBeTruthy();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'] }),
    );

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Remove receipt photo' }));
    });
    expect(await screen.findByRole('button', { name: 'Add receipt photo' })).toBeTruthy();
  });
});
