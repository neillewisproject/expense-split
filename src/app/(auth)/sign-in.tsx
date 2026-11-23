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
  const {
    isConfigured,
    error: authError,
    continueAsGuest,
    sendSignInLink,
    verifyEmailCode,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  async function handleSendLink() {
    setError(null);
    setMessage(null);
    setIsSending(true);
    try {
      await sendSignInLink(email, inviteCode);
      setCodeSent(true);
      setMessage('Check your email. Enter the 6-digit code below, or open the link on this phone.');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send the sign-in link.');
    } finally {
      setIsSending(false);
    }
  }

  async function handleVerifyCode() {
    setError(null);
    setIsVerifying(true);
    try {
      await verifyEmailCode(email, code);
      if (inviteCode) {
        router.replace({ pathname: '/join/[code]', params: { code: inviteCode } });
      }
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : 'That code is invalid or expired.',
      );
    } finally {
      setIsVerifying(false);
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
            We’ll email you a one-time code. No password required.
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
              codeSent ? styles.secondaryButton : styles.button,
              (!isConfigured || isSending || !email.trim()) && styles.disabled,
            ]}>
            <ThemedText style={codeSent ? styles.secondaryButtonText : styles.buttonText}>
              {isSending ? 'Sending…' : codeSent ? 'Send a new code' : 'Send sign-in code'}
            </ThemedText>
          </Pressable>
          {codeSent ? (
            <>
              <View style={styles.field}>
                <ThemedText type="smallBold">Code from email</ThemedText>
                <TextInput
                  accessibilityLabel="Code from email"
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  maxLength={10}
                  onChangeText={setCode}
                  placeholder="123456"
                  placeholderTextColor={theme.textSecondary}
                  style={inputStyle}
                  textContentType="oneTimeCode"
                  value={code}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isVerifying || code.trim().length < 6}
                onPress={() => void handleVerifyCode()}
                style={[styles.button, (isVerifying || code.trim().length < 6) && styles.disabled]}>
                <ThemedText style={styles.buttonText}>
                  {isVerifying ? 'Verifying…' : 'Sign in'}
                </ThemedText>
              </Pressable>
            </>
          ) : null}
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
  secondaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#3c87f7',
    padding: Spacing.three,
  },
  secondaryButtonText: {
    color: '#3c87f7',
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
