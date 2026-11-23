import * as AppleAuthentication from 'expo-apple-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, IconBadge, neu } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import type { SocialProvider } from '@/features/auth/social-sign-in';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const PROVIDER_NAMES: Record<SocialProvider, string> = { google: 'Google', apple: 'Apple' };

export default function SignInScreen() {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const { inviteCode } = useLocalSearchParams<{ inviteCode?: string }>();
  const { isConfigured, error: authError, continueAsGuest, signInWithProvider } = useAuth();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = !isConfigured || pending !== null;

  async function handleSignIn(provider: SocialProvider) {
    // The native Apple button has no disabled state, so guard here as well.
    if (disabled) return;
    setError(null);
    setPending(provider);
    try {
      const signedIn = await signInWithProvider(provider, inviteCode);
      if (signedIn && inviteCode) {
        router.replace({ pathname: '/join/[code]', params: { code: inviteCode } });
      }
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : `Could not sign in with ${PROVIDER_NAMES[provider]}.`,
      );
    } finally {
      setPending(null);
    }
  }

  function handleContinueAsGuest() {
    continueAsGuest();
    router.replace('/');
  }

  const googleButton = (
    <Button
      key="google"
      label="Continue with Google"
      loading={pending === 'google'}
      disabled={disabled}
      onPress={() => void handleSignIn('google')}
    />
  );
  const appleButton =
    Platform.OS === 'ios' ? (
      <View
        key="apple"
        style={[
          styles.appleShadow,
          { backgroundColor: theme.card },
          neu(theme, disabled ? 'flat' : 'raisedSm'),
          disabled && styles.disabled,
        ]}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            colorScheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={Radius.lg}
          style={styles.appleButton}
          onPress={() => void handleSignIn('apple')}
        />
      </View>
    ) : (
      <Button
        key="apple"
        variant="secondary"
        label="Continue with Apple"
        loading={pending === 'apple'}
        disabled={disabled}
        onPress={() => void handleSignIn('apple')}
      />
    );

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
            <ThemedText type="heading">Sign in</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Use your Google or Apple account to share groups and back up to the cloud. No password
              required.
            </ThemedText>
            {/* Apple's guidelines expect its button first on Apple devices. */}
            {Platform.OS === 'ios' ? [appleButton, googleButton] : [googleButton, appleButton]}
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
  appleShadow: { borderRadius: Radius.lg },
  appleButton: { height: 50 },
  disabled: { opacity: 0.5, pointerEvents: 'none' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
