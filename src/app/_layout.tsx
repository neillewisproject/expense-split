import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const { user, isGuest, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={Boolean(user) || isGuest} redirectTo="/sign-in">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!user} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="join/[code]" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const navigationTheme = useMemo(() => {
    const dark = colorScheme === 'dark';
    const base = dark ? DarkTheme : DefaultTheme;
    const palette = Colors[dark ? 'dark' : 'light'];
    // Match navigator backgrounds to the app so transitions never flash black or grey.
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.accent,
        background: palette.background,
        card: palette.background,
        text: palette.text,
        border: palette.border,
      },
    };
  }, [colorScheme]);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AnimatedSplashOverlay />
            <AppNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
