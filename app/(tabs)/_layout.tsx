import { Tabs } from 'expo-router';
import { TimeIcon, SettingsIcon } from '@/components/ui/icons';
import { COLORS } from '@/constants/theme';

export default function TabsLayout() {
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
        name="settings"
        options={{ title: '설정', tabBarIcon: ({ color, size }) => <SettingsIcon color={String(color)} size={size} /> }}
      />
    </Tabs>
  );
}
