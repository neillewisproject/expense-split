import { completeSignInLink, readSignInLink } from './sign-in-link';

const mockExchange = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ auth: { exchangeCodeForSession: mockExchange } }),
}));

test('reads a PKCE code even when Supabase falls back to the app root', () => {
  expect(readSignInLink('exp://192.168.1.5:8081/--/?code=abc%2D1')).toEqual({ code: 'abc-1' });
  expect(readSignInLink('expensesplit://auth/callback?code=xyz&inviteCode=G1')).toEqual({
    code: 'xyz',
  });
  expect(readSignInLink('expensesplit://')).toBeNull();
  expect(readSignInLink('expensesplit://join/ABC?code=x')).toBeNull();
});

test('prefers a readable error from the query or fragment', () => {
  expect(
    readSignInLink(
      'expensesplit://#error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
    ),
  ).toEqual({ error: 'Email link is invalid or has expired' });
});

test('exchanges each code only once', async () => {
  mockExchange.mockResolvedValue({ error: null });
  await Promise.all([completeSignInLink('once'), completeSignInLink('once')]);
  expect(mockExchange).toHaveBeenCalledTimes(1);

  mockExchange.mockResolvedValueOnce({ error: new Error('expired') });
  await expect(completeSignInLink('bad')).rejects.toThrow('expired');
});
