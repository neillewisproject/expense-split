import { render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import RootLayout from '@/app/_layout';

jest.mock('@/components/animated-icon', () => ({
  AnimatedSplashOverlay: () => null,
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
}));

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const { useEnsureGestureHandlerRootView } = jest.requireActual<{
    useEnsureGestureHandlerRootView: () => void;
  }>('react-native-gesture-handler/lib/module/v3/detectors/useEnsureGestureHandlerRootView');
  const Stack = () => {
    useEnsureGestureHandlerRootView();
    return <Text>Expense row</Text>;
  };
  function StackScreen() {
    return null;
  }
  Stack.Screen = StackScreen;
  function ThemeProvider({ children }: PropsWithChildren) {
    return <>{children}</>;
  }
  return {
    DarkTheme: {},
    DefaultTheme: {},
    Stack,
    ThemeProvider,
  };
});

it('provides the root context required by gesture detectors', async () => {
  await render(<RootLayout />);
  expect(screen.getByText('Expense row')).toBeOnTheScreen();
});
