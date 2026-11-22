import { render, screen } from '@testing-library/react-native';

import { EmptyState } from './empty-state';

describe('<EmptyState />', () => {
  it('shows the title and message', async () => {
    await render(<EmptyState title="No expenses yet" message="Add your first expense" />);

    expect(screen.getByText('No expenses yet')).toBeOnTheScreen();
    expect(screen.getByText('Add your first expense')).toBeOnTheScreen();
  });
});
