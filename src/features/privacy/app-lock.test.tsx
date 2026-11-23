import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Text } from 'react-native';

import { AppLockProvider } from './app-lock';

jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC: 2 },
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

describe('app lock', () => {
  beforeEach(() => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('enabled');
    jest.mocked(LocalAuthentication.getEnrolledLevelAsync).mockResolvedValue(2);
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: true });
  });

  it('hides financial content until device authentication succeeds', async () => {
    await render(
      <AppLockProvider>
        <Text>Private ledger</Text>
      </AppLockProvider>,
    );
    expect(screen.queryByText('Private ledger')).toBeNull();
    fireEvent.press(await screen.findByText('Unlock with device authentication'));
    expect(await screen.findByText('Private ledger')).toBeTruthy();
  });

  it('does not unlock after canceled authentication', async () => {
    jest
      .mocked(LocalAuthentication.authenticateAsync)
      .mockResolvedValue({ success: false, error: 'user_cancel' });
    await render(
      <AppLockProvider>
        <Text>Private ledger</Text>
      </AppLockProvider>,
    );
    fireEvent.press(await screen.findByText('Unlock with device authentication'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByText('Private ledger')).toBeNull();
  });
});
