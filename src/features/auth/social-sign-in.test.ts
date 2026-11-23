import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { signInWithProvider } from './social-sign-in';

const mockAuth = {
  signInWithOAuth: jest.fn(),
  signInWithIdToken: jest.fn(),
  updateUser: jest.fn(),
  exchangeCodeForSession: jest.fn(),
};
jest.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ auth: mockAuth }) }));
jest.mock('expo-linking', () => ({
  createURL: (path: string, options?: { queryParams?: Record<string, string> }) => {
    const query = new URLSearchParams(options?.queryParams).toString();
    return `expensesplit://${path}${query ? `?${query}` : ''}`;
  },
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  randomUUID: () => 'raw-nonce',
  digestStringAsync: async () => 'hashed-nonce',
}));
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: jest.fn(),
}));

const openAuthSession = jest.mocked(WebBrowser.openAuthSessionAsync);
const appleSignIn = jest.mocked(AppleAuthentication.signInAsync);

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.signInWithOAuth.mockResolvedValue({
    data: { url: 'https://project.supabase.co/auth/v1/authorize' },
    error: null,
  });
  mockAuth.exchangeCodeForSession.mockResolvedValue({ error: null });
  mockAuth.signInWithIdToken.mockResolvedValue({ error: null });
  mockAuth.updateUser.mockResolvedValue({ error: null });
});

afterEach(() => jest.restoreAllMocks());

test('Google opens browser OAuth, keeps the invite in the redirect, and exchanges the code', async () => {
  openAuthSession.mockResolvedValue({
    type: 'success',
    url: 'expensesplit://auth/callback?inviteCode=G1&code=google-code',
  });

  await expect(signInWithProvider('google', 'G1')).resolves.toBe(true);

  expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
    provider: 'google',
    options: {
      redirectTo: 'expensesplit://auth/callback?inviteCode=G1',
      skipBrowserRedirect: true,
    },
  });
  // Android matches the return URL by prefix, so it must not depend on query parameter order.
  expect(openAuthSession).toHaveBeenCalledWith(
    'https://project.supabase.co/auth/v1/authorize',
    'expensesplit://auth/callback',
  );
  expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('google-code');
});

test('closing the browser is a cancellation, and provider errors are surfaced', async () => {
  openAuthSession.mockResolvedValueOnce({ type: 'cancel' } as WebBrowser.WebBrowserResult);
  await expect(signInWithProvider('google')).resolves.toBe(false);
  expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();

  openAuthSession.mockResolvedValueOnce({
    type: 'success',
    url: 'expensesplit://auth/callback#error=access_denied&error_description=Provider+is+not+enabled',
  });
  await expect(signInWithProvider('google')).rejects.toThrow('Provider is not enabled');
});

test('Apple on iOS signs in natively with a nonce and saves the first-time name', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  appleSignIn.mockResolvedValue({
    identityToken: 'apple-id-token',
    fullName: { givenName: 'Asha', middleName: null, familyName: 'Rao' },
  } as AppleAuthentication.AppleAuthenticationCredential);

  await expect(signInWithProvider('apple')).resolves.toBe(true);

  expect(appleSignIn).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'hashed-nonce' }));
  expect(mockAuth.signInWithIdToken).toHaveBeenCalledWith({
    provider: 'apple',
    token: 'apple-id-token',
    nonce: 'raw-nonce',
  });
  expect(mockAuth.updateUser).toHaveBeenCalledWith({
    data: { full_name: 'Asha Rao', given_name: 'Asha', family_name: 'Rao' },
  });
  expect(mockAuth.signInWithOAuth).not.toHaveBeenCalled();
});

test('cancelling the native Apple sheet does not sign in', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  appleSignIn.mockRejectedValue(
    Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }),
  );

  await expect(signInWithProvider('apple')).resolves.toBe(false);
  expect(mockAuth.signInWithIdToken).not.toHaveBeenCalled();
});

test('Apple on Android uses browser OAuth', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  openAuthSession.mockResolvedValue({
    type: 'success',
    url: 'expensesplit://auth/callback?code=apple-code',
  });

  await expect(signInWithProvider('apple')).resolves.toBe(true);

  expect(appleSignIn).not.toHaveBeenCalled();
  expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith(
    expect.objectContaining({ provider: 'apple' }),
  );
  expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('apple-code');
});
