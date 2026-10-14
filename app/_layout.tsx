import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { openDb } from '@/lib/localDb';
import { useLockStore } from '@/store/useLockStore';
import { LockScreen } from '@/components/lock/LockScreen';
import { PinSetupScreen } from '@/components/lock/PinSetupScreen';
import { DbRecovery } from '@/components/DbRecovery';
import { COLORS } from '@/constants/theme';
import type { DbOpenResult } from '@/types';

const CAPTURE_KEY = 'thinketh-lock';

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );
}

// 잠금 해제 뒤에만 DB를 연다. 열 수 없으면 복구 화면을 보여 주고 앱 본체는 렌더링하지 않는다 (D-253).
function DbGate({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<DbOpenResult | null>(null);

  const open = useCallback(() => {
    setResult(null);
    openDb().then(setResult);
  }, []);

  useEffect(() => {
    open();
  }, [open]);

  if (!result) return <Loading />;
  if (!result.ok) return <DbRecovery reason={result.reason} onRetry={open} />;
  return <>{children}</>;
}

export default function RootLayout() {
  const status = useLockStore((s) => s.status);
  const init = useLockStore((s) => s.init);
  const setupPin = useLockStore((s) => s.setupPin);
  const onBackground = useLockStore((s) => s.onBackground);
  const onForeground = useLockStore((s) => s.onForeground);
  const [fontsLoaded] = useFonts({
    'DSEG7Classic-Regular': require('../assets/fonts/DSEG7Classic-Regular.ttf'),
    'DSEG7Classic-Bold': require('../assets/fonts/DSEG7Classic-Bold.ttf'),
  });

  useEffect(() => {
    init();
  }, [init]);

  // 백그라운드로 가면 잠금 타이머를 시작하고, 돌아왔을 때 설정 시간이 지났으면 다시 잠근다 (D-235)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        onForeground();
        if (useLockStore.getState().status === 'unlocked') allowScreenCaptureAsync(CAPTURE_KEY).catch(() => undefined);
      } else {
        onBackground();
        // 최근 앱 목록 미리보기를 가리기 위해 백그라운드 진입 시점에 화면 보호를 켠다
        preventScreenCaptureAsync(CAPTURE_KEY).catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [onBackground, onForeground]);

  // 잠금 중·PIN 설정 중에는 화면 보호를 켜 두고, 해제된 포그라운드에서는 풀어 평소 스크린샷을 허용한다
  useEffect(() => {
    if (status === 'unlocked') {
      allowScreenCaptureAsync(CAPTURE_KEY).catch(() => undefined);
    } else {
      preventScreenCaptureAsync(CAPTURE_KEY).catch(() => undefined);
    }
  }, [status]);

  return (
    <SafeAreaProvider>
      <StatusBar style={status === 'unlocked' ? 'dark' : 'light'} />
      {status === 'loading' || !fontsLoaded ? (
        <Loading />
      ) : status === 'needs_setup' ? (
        <PinSetupScreen
          title="PIN 설정"
          askBiometric
          onSubmit={async (pin, enableBiometric) => {
            await setupPin(pin, enableBiometric);
          }}
        />
      ) : status === 'locked' ? (
        <LockScreen />
      ) : (
        <DbGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="modal/time-log" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal/time-settings" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal/pin-change" options={{ presentation: 'modal' }} />
          </Stack>
        </DbGate>
      )}
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
