import * as AppleAuthentication from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/lib/supabase';

import { completeSignInLink, readSignInLink } from './sign-in-link';

export type SocialProvider = 'google' | 'apple';

/**
 * Signs in with Google or Apple. Resolves `true` once a session exists and `false` when the user
 * closes the sign-in sheet. Apple uses the native sheet on iOS; everything else uses Supabase's
 * browser OAuth flow, which returns a PKCE code to `auth/callback`.
 */
export function signInWithProvider(
  provider: SocialProvider,
  inviteCode?: string,
): Promise<boolean> {
  if (provider === 'apple' && Platform.OS === 'ios') return signInWithAppleNative();
  return signInWithBrowser(provider, inviteCode);
}

async function signInWithBrowser(provider: SocialProvider, inviteCode?: string) {
  const callbackUrl = Linking.createURL('auth/callback');
  // On Android the redirect is also routed to the callback screen, which needs the invite code.
  const redirectTo = inviteCode
    ? Linking.createURL('auth/callback', { queryParams: { inviteCode } })
    : callbackUrl;
  const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, callbackUrl);
  if (result.type !== 'success') return false;

  const link = readSignInLink(result.url);
  if (link?.error) throw new Error(link.error);
  if (!link?.code) throw new Error('Sign-in did not return a one-time code. Please try again.');
  await completeSignInLink(link.code);
  return true;
}

function isCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED'
  );
}

async function signInWithAppleNative() {
  // Apple signs the hashed nonce into the ID token; Supabase verifies it against the raw value.
  const rawNonce = randomUUID();
  const hashedNonce = await digestStringAsync(CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if (isCancellation(error)) return false;
    throw error;
  }
  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token. Please try again.');
  }

  const client = getSupabaseClient();
  const { error } = await client.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Apple shares the user's name only on the first authorization, so keep it in user metadata.
  const givenName = credential.fullName?.givenName ?? undefined;
  const familyName = credential.fullName?.familyName ?? undefined;
  const fullName = [givenName, credential.fullName?.middleName, familyName]
    .filter(Boolean)
    .join(' ');
  if (fullName) {
    const { error: profileError } = await client.auth.updateUser({
      data: { full_name: fullName, given_name: givenName, family_name: familyName },
    });
    if (profileError) console.warn('Could not save the Apple account name.', profileError.message);
  }
  return true;
}
