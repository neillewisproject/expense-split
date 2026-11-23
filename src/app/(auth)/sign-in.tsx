import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen() {
  const theme = useTheme();
  const { inviteCode } = useLocalSearchParams<{ inviteCode?: string }>();
  const { isConfigured, error: authError, continueAsGuest, sendSignInLink } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSendLink() {
    setError(null);
    setMessage(null);
    setIsSending(true);
    try {
      await sendSignInLink(email, inviteCode);
      setMessage('Check your email and open the sign-in link on this device.');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send the sign-in link.');
    } finally {
      setIsSending(false);
    }
  }

  function handleContinueAsGuest() {
    continueAsGuest();
    router.replace('/');
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="title">Expense Split</ThemedText>
          <ThemedText type="subtitle">Sign in with email</ThemedText>
          <ThemedText themeColor="textSecondary">
            We’ll email you a secure, one-time sign-in link. No password required.
          </ThemedText>
          {inviteCode ? (
            <ThemedText type="smallBold">Sign in to accept your group invitation.</ThemedText>
          ) : null}
          {!isConfigured ? (
            <ThemedText accessibilityRole="alert" style={styles.error}>
              Supabase is not configured. Copy .env.example to .env, add your project URL and
              publishable key, then restart Expo.
            </ThemedText>
          ) : null}
          {authError ? (
            <ThemedText accessibilityRole="alert" style={styles.error}>
              {authError}
            </ThemedText>
          ) : null}
          <View style={styles.field}>
            <ThemedText type="smallBold">Email address</ThemedText>
            <TextInput
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
              value={email}
            />
          </View>
          {message ? (
            <ThemedText accessibilityRole="alert" style={styles.success}>
              {message}
            </ThemedText>
          ) : null}
          {error ? (
            <ThemedText accessibilityRole="alert" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={!isConfigured || isSending || !email.trim()}
            onPress={() => void handleSendLink()}
            style={[
              styles.button,
              (!isConfigured || isSending || !email.trim()) && styles.disabled,
            ]}>
            <ThemedText style={styles.buttonText}>
              {isSending ? 'Sending…' : 'Send sign-in link'}
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleContinueAsGuest}>
            <ThemedText type="linkPrimary">Continue using local-only groups</ThemedText>
          </Pressable>
        </View>
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
    paddingHorizontal: Spacing.four,
  },
  content: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
    padding: Spacing.three,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
  error: {
    color: '#b42318',
  },
  success: {
    color: '#177245',
  },
});
