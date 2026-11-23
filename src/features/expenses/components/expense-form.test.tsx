import { fireEvent, render, screen } from '@testing-library/react-native';

import { createDefaultExpenseValues, ExpenseForm } from './expense-form';

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
});
