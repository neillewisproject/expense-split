import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isGuest: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  continueAsGuest: () => void;
  sendSignInLink: (email: string, inviteCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected authentication error.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(isConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;

    let active = true;
    const client: SupabaseClient = getSupabaseClient();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession) setIsGuest(false);
      setError(null);
      setIsLoading(false);
    });

    void client.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
        } else {
          setSession(data.session);
        }
        setIsLoading(false);
      })
      .catch((sessionError: unknown) => {
        if (!active) return;
        setError(getErrorMessage(sessionError));
        setIsLoading(false);
      });

    const appStateSubscription =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (state) => {
            if (state === 'active') void client.auth.startAutoRefresh();
            else void client.auth.stopAutoRefresh();
          });
    if (Platform.OS !== 'web' && AppState.currentState === 'active') {
      void client.auth.startAutoRefresh();
    }

    return () => {
      active = false;
      subscription.unsubscribe();
      appStateSubscription?.remove();
      void client.auth.stopAutoRefresh();
    };
  }, [isConfigured]);

  const sendSignInLink = useCallback(async (email: string, inviteCode?: string) => {
    const redirectTo = Linking.createURL('auth/callback', {
      queryParams: inviteCode ? { inviteCode } : undefined,
    });
    const { error: signInError } = await getSupabaseClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (signInError) throw signInError;
  }, []);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await getSupabaseClient().auth.signOut();
    if (signOutError) throw signOutError;
  }, []);

  const continueAsGuest = useCallback(() => setIsGuest(true), []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isGuest,
      isLoading,
      isConfigured,
      error,
      continueAsGuest,
      sendSignInLink,
      signOut,
    }),
    [continueAsGuest, error, isConfigured, isGuest, isLoading, sendSignInLink, session, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
