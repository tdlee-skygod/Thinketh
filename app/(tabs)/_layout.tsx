import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { TimeIcon, TargetIcon, SettingsIcon } from '@/components/ui/icons';
import { COLORS } from '@/constants/theme';

export default function TabsLayout() {
  const session = useAuthStore((s) => s.session);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      <Tabs.Screen
        name="time"
        options={{ title: 'Time', tabBarIcon: ({ color, size }) => <TimeIcon color={String(color)} size={size} /> }}
      />
      <Tabs.Screen
        name="goals"
        options={{ title: '목표', tabBarIcon: ({ color, size }) => <TargetIcon color={String(color)} size={size} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: '설정', tabBarIcon: ({ color, size }) => <SettingsIcon color={String(color)} size={size} /> }}
      />
    </Tabs>
  );
}
