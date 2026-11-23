import { Stack } from 'expo-router';

export const unstable_settings = {
  anchor: 'sign-in',
};

export default function AuthGroupLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
