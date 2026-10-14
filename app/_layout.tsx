import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { openDb } from '@/lib/localDb';
import { COLORS, SPACING, FONT } from '@/constants/theme';
import type { DbOpenResult } from '@/types';

export default function RootLayout() {
  const [dbResult, setDbResult] = useState<DbOpenResult | null>(null);
  const [fontsLoaded] = useFonts({
    'DSEG7Classic-Regular': require('../assets/fonts/DSEG7Classic-Regular.ttf'),
    'DSEG7Classic-Bold': require('../assets/fonts/DSEG7Classic-Bold.ttf'),
  });

  useEffect(() => {
    openDb().then(setDbResult);
  }, []);

  if (!dbResult || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  // 복구 화면(백업에서 가져오기/새로 시작)은 단계 0 조각 3에서 만든다. 지금은 원인만 안내하고 DB는 건드리지 않는다.
  if (!dbResult.ok) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.loading}>
          <Text style={styles.errorText}>
            {dbResult.reason === 'newer_version'
              ? '앱을 최신 버전으로 업데이트해 주세요.'
              : '저장된 데이터를 열 수 없습니다.'}
          </Text>
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
    padding: SPACING.lg,
  },
  errorText: { color: COLORS.textDark, fontSize: FONT.size.md, textAlign: 'center' },
});
