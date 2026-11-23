import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppLock } from '@/features/privacy/app-lock';

export default function PrivacyScreen() {
  const { enabled, setEnabled } = useAppLock();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await setEnabled(!enabled);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change app lock');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <ThemedText type="linkPrimary">Back</ThemedText>
          </Pressable>
          <ThemedText type="subtitle">Privacy and app lock</ThemedText>
          <ThemedText>App lock: {enabled ? 'enabled' : 'disabled'}</ThemedText>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void toggle()}>
            <ThemedText type="linkPrimary">
              {busy ? 'Authenticating…' : `${enabled ? 'Disable' : 'Enable'} device lock`}
            </ThemedText>
          </Pressable>
          {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
          <ThemedText>
            Device lock hides app content at startup and after backgrounding. It is not database
            encryption. Your device passcode can be used if biometrics are unavailable. Face ID
            requires an iOS development build.
          </ThemedText>
          <ThemedText>
            Existing local groups and personal records are not uploaded automatically. Shared groups
            and explicitly uploaded private backups use Supabase. Receipt photos stay on this device
            unless you explicitly share them from a saved shared expense.
          </ThemedText>
          <ThemedText>
            File exports can contain financial details. Store them privately. No bank connections,
            payment processing, or cloud OCR are enabled.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
