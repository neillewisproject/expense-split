import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { completeSignInLink } from '@/features/auth/sign-in-link';

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function AuthCallbackScreen() {
  const {
    code: rawCode,
    inviteCode: rawInviteCode,
    error: rawError,
    error_description: rawErrorDescription,
  } = useLocalSearchParams<{
    code?: string | string[];
    inviteCode?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const { isConfigured } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);
  const code = single(rawCode);
  const inviteCode = single(rawInviteCode);
  const callbackError = single(rawError) ?? single(rawErrorDescription);
  const displayError =
    error ??
    (!isConfigured
      ? 'Supabase is not configured.'
      : callbackError
        ? callbackError
        : !code
          ? 'The sign-in link is missing its one-time code. Request a new link and try again.'
          : null);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (!isConfigured || callbackError || !code) return;

    void completeSignInLink(code)
      .then(() => {
        if (inviteCode) {
          router.replace({ pathname: '/join/[code]', params: { code: inviteCode } });
        } else {
          router.replace('/');
        }
      })
      .catch((exchangeError: unknown) => {
        setError(
          exchangeError instanceof Error
            ? exchangeError.message
            : 'Could not verify the sign-in link. Request a new link and try again.',
        );
      });
  }, [callbackError, code, inviteCode, isConfigured]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {displayError ? (
          <>
            <ThemedText type="subtitle">Sign-in link failed</ThemedText>
            <ThemedText accessibilityRole="alert" style={styles.error}>
              {displayError}
            </ThemedText>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/sign-in')}>
              <ThemedText type="linkPrimary">Return to sign in</ThemedText>
            </Pressable>
          </>
        ) : (
          <ThemedText type="subtitle">Verifying sign-in link…</ThemedText>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  error: {
    color: '#b42318',
  },
});
