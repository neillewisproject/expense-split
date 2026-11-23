import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, IconBadge, inputWell } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { Field } from '@/features/expenses/components/personal-ui';
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

  const sendDisabled = !isConfigured || isSending || !email.trim();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <IconBadge icon="wallet" size={64} />
            <ThemedText type="title" accessibilityRole="header">
              Expense Split
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Track your spending and split costs with friends.
            </ThemedText>
          </View>

          {inviteCode ? (
            <Banner tone="info" message="Sign in to accept your group invitation." />
          ) : null}
          {!isConfigured ? (
            <Banner
              tone="warning"
              message="Supabase is not configured. Copy .env.example to .env, add your project URL and publishable key, then restart Expo."
            />
          ) : null}
          {authError ? <Banner tone="danger" message={authError} /> : null}

          <Card>
            <ThemedText type="heading">Sign in with email</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              We’ll email you a one-time code. No password required.
            </ThemedText>
            <Field
              label="Email address"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Button
              variant={codeSent ? 'secondary' : 'primary'}
              icon="signIn"
              label={isSending ? 'Sending…' : codeSent ? 'Send a new code' : 'Send sign-in code'}
              disabled={sendDisabled}
              onPress={() => void handleSendLink()}
            />
            {codeSent ? (
              <>
                <View style={styles.field}>
                  <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
                    Code from email
                  </ThemedText>
                  <TextInput
                    accessibilityLabel="Code from email"
                    autoComplete="one-time-code"
                    keyboardType="number-pad"
                    maxLength={10}
                    onChangeText={setCode}
                    placeholder="123456"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.code, { color: theme.text }, inputWell(theme)]}
                    textContentType="oneTimeCode"
                    value={code}
                  />
                </View>
                <Button
                  label={isVerifying ? 'Verifying…' : 'Sign in'}
                  disabled={isVerifying || code.trim().length < 6}
                  onPress={() => void handleVerifyCode()}
                />
              </>
            ) : null}
            {message ? <Banner tone="success" message={message} /> : null}
            {error ? <Banner tone="danger" message={error} /> : null}
          </Card>

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
            <ThemedText type="caption" themeColor="textSecondary">
              or
            </ThemedText>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
          </View>

          <Button
            variant="secondary"
            label="Continue without an account"
            accessibilityLabel="Continue using local-only groups"
            onPress={handleContinueAsGuest}
          />
          <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
            Everything stays on this device. You can sign in later from More.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
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
    maxWidth: 480,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  brand: { alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two },
  center: { textAlign: 'center' },
  field: { gap: Spacing.one },
  label: { fontWeight: 600 },
  code: {
    minHeight: 56,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 6,
    textAlign: 'center',
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
