import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);

  if (session) {
    return <Redirect href="/(tabs)/time" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
