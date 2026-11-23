import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const LOCK_KEY = 'expense-split:app-lock';
type LockContext = { enabled: boolean; setEnabled: (value: boolean) => Promise<void> };
const Context = createContext<LockContext | null>(null);

async function authenticate(): Promise<void> {
  if (Platform.OS === 'web')
    throw new Error('Device authentication is available on Android and iOS');
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE)
    throw new Error('Set up a device passcode or biometrics first');
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Expense Split',
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });
  if (!result.success)
    throw new Error('Device authentication did not complete. Try unlocking again.');
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [enabled, updateEnabled] = useState(false);
  const [loaded, setLoaded] = useState(Platform.OS === 'web');
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const next = (await SecureStore.getItemAsync(LOCK_KEY)) === 'enabled';
      setError(null);
      updateEnabled(next);
      setLocked(next);
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read app-lock settings');
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    void SecureStore.getItemAsync(LOCK_KEY).then(
      (value) => {
        if (!mounted) return;
        const next = value === 'enabled';
        updateEnabled(next);
        setLocked(next);
        setLoaded(true);
      },
      (cause: unknown) => {
        if (mounted)
          setError(cause instanceof Error ? cause.message : 'Could not read app-lock settings');
      },
    );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (enabled && state === 'background') setLocked(true);
    });
    return () => listener.remove();
  }, [enabled]);

  async function setEnabled(value: boolean) {
    await authenticate();
    await SecureStore.setItemAsync(LOCK_KEY, value ? 'enabled' : 'disabled');
    updateEnabled(value);
    setLocked(false);
  }

  async function unlock() {
    setBusy(true);
    setError(null);
    try {
      if (!loaded) await load();
      else {
        await authenticate();
        setLocked(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not unlock the app');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Context.Provider value={{ enabled, setEnabled }}>
      {!loaded || locked ? (
        <ThemedView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <View style={{ gap: 20 }}>
            <ThemedText type="subtitle">Expense Split is locked</ThemedText>
            {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void unlock()}>
              <ThemedText type="linkPrimary">
                {busy ? 'Unlocking…' : 'Unlock with device authentication'}
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      ) : (
        children
      )}
    </Context.Provider>
  );
}

export function useAppLock(): LockContext {
  const context = useContext(Context);
  if (!context) throw new Error('useAppLock requires AppLockProvider');
  return context;
}
