import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import SignInScreen from '@/app/(auth)/sign-in';

const mockSignInWithProvider = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ inviteCode: 'G1' }),
}));
jest.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({
    isConfigured: true,
    error: null,
    continueAsGuest: jest.fn(),
    signInWithProvider: mockSignInWithProvider,
  }),
}));
jest.mock('expo-apple-authentication', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AppleAuthenticationButtonType: { CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { WHITE: 0, BLACK: 2 },
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>Continue with Apple</Text>
      </Pressable>
    ),
  };
});

beforeEach(() => jest.clearAllMocks());

it('returns to the group invitation after signing in', async () => {
  mockSignInWithProvider.mockResolvedValue(true);
  await render(<SignInScreen />);

  fireEvent.press(screen.getByText('Continue with Google'));

  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/join/[code]',
      params: { code: 'G1' },
    }),
  );
  expect(mockSignInWithProvider).toHaveBeenCalledWith('google', 'G1');
});

it('stays on sign-in when cancelled and shows provider errors', async () => {
  mockSignInWithProvider
    .mockResolvedValueOnce(false)
    .mockRejectedValueOnce(new Error('Provider is not enabled'));
  await render(<SignInScreen />);

  fireEvent.press(screen.getByText('Continue with Apple'));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled(),
  );
  expect(mockSignInWithProvider).toHaveBeenCalledWith('apple', 'G1');
  expect(router.replace).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText('Continue with Apple'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Provider is not enabled');
});
