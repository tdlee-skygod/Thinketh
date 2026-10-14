import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useAuthStore } from '@/store/useAuthStore';
import { COLORS } from '@/constants/theme';

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const [fontsLoaded] = useFonts({
    'DSEG7Classic-Regular': require('../assets/fonts/DSEG7Classic-Regular.ttf'),
    'DSEG7Classic-Bold': require('../assets/fonts/DSEG7Classic-Bold.ttf'),
  });

  useEffect(() => {
    init();
  }, [init]);

  if (!isInitialized || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="modal/time-log" options={{ presentation: 'modal' }} />
        <Stack.Screen name="modal/time-settings" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgLighter,
  },
});
