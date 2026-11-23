import { Stack } from 'expo-router';

import { GroupCloudSync } from '@/features/groups/components/group-cloud-sync';
import { AppLockProvider } from '@/features/privacy/app-lock';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function AppGroupLayout() {
  return (
    <AppLockProvider>
      <GroupCloudSync />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="groups/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="groups/[id]" />
        <Stack.Screen name="expenses/[id]" />
        <Stack.Screen name="add-expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="spending-by-category" />
      </Stack>
    </AppLockProvider>
  );
}
