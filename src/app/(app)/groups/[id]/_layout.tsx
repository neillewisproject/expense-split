import { Stack } from 'expo-router';

export default function GroupStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-expense" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settle-up" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
