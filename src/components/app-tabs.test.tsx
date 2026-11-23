import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import AppTabs from './app-tabs';

jest.mock('expo-router/ui', () => {
  const { View: MockView } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Tabs: ({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) => (
      <MockView testID="tabs-root" style={style}>
        {children}
      </MockView>
    ),
    TabSlot: () => null,
    TabList: ({ children }: { children: ReactNode }) => children,
    TabTrigger: ({ children }: { children: ReactNode }) => children,
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

it('keeps the tab root full height so screens are not collapsed above the tab bar', async () => {
  await render(<AppTabs />);
  expect(screen.getByTestId('tabs-root')).toHaveStyle({ flex: 1 });
  expect(screen.getAllByRole('tab')).toHaveLength(5);
});
