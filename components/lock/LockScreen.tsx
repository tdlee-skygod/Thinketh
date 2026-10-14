import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { PinPad } from '@/components/lock/PinPad';
import { PinSetupScreen } from '@/components/lock/PinSetupScreen';
import { TextLink } from '@/components/lock/TextLink';
import { hasDeviceLock, useLockStore } from '@/store/useLockStore';
import { attemptsBeforeLockout } from '@/lib/pin';
import { COLORS, FONT, SPACING } from '@/constants/theme';

// 앱 잠금 화면 (F-23, D-235). 잠금 중에는 다른 어떤 화면도 렌더링하지 않는다.
export function LockScreen() {
  const biometricEnabled = useLockStore((s) => s.biometricEnabled);
  const failCount = useLockStore((s) => s.failCount);
  const lockUntilMs = useLockStore((s) => s.lockUntilMs);
  const unlock = useLockStore((s) => s.unlock);
  const unlockWithBiometric = useLockStore((s) => s.unlockWithBiometric);
  const authenticateDevice = useLockStore((s) => s.authenticateDevice);
  const setupPin = useLockStore((s) => s.setupPin);

  const [errorSignal, setErrorSignal] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [resetting, setResetting] = useState(false);
  const [checking, setChecking] = useState(false);
  const triedBiometric = useRef(false);

  // 생체인증은 화면이 처음 뜰 때 한 번만 자동으로 시도한다
  useEffect(() => {
    if (biometricEnabled && !triedBiometric.current) {
      triedBiometric.current = true;
      unlockWithBiometric();
    }
  }, [biometricEnabled, unlockWithBiometric]);

  // 연속 실패 대기 시간 카운트다운
  useEffect(() => {
    if (!lockUntilMs || lockUntilMs <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockUntilMs]);

  const waitSec = lockUntilMs && lockUntilMs > now ? Math.ceil((lockUntilMs - now) / 1000) : 0;

  const handleComplete = async (pin: string) => {
    setChecking(true);
    try {
      const result = await unlock(pin);
      if (result !== 'ok') setErrorSignal((n) => n + 1);
    } finally {
      setChecking(false);
    }
  };

  const handleForgot = async () => {
    if (!(await hasDeviceLock())) {
      Alert.alert(
        'PIN을 재설정할 수 없어요',
        '이 기기에 화면 잠금(PIN·패턴·지문 등)이 설정되어 있지 않아 PIN을 재설정할 수 없어요.'
      );
      return;
    }
    if (await authenticateDevice('PIN 재설정을 위해 기기 잠금을 확인합니다')) setResetting(true);
  };

  if (resetting) {
    return (
      <PinSetupScreen
        title="새 PIN 설정"
        onSubmit={async (pin) => {
          await setupPin(pin, biometricEnabled);
        }}
        onCancel={() => setResetting(false)}
      />
    );
  }

  const remaining = attemptsBeforeLockout(failCount);
  const hint =
    waitSec > 0
      ? `PIN을 여러 번 틀렸어요. ${waitSec}초 뒤에 다시 시도해 주세요`
      : failCount > 0 && remaining > 0
        ? `PIN이 달라요. ${remaining}번 더 틀리면 잠시 대기해야 해요`
        : 'PIN 6자리를 입력해 주세요';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thinketh</Text>
      <Text style={styles.message}>{hint}</Text>
      <PinPad onComplete={handleComplete} disabled={waitSec > 0 || checking} errorSignal={errorSignal} />
      <View style={styles.links}>
        {biometricEnabled && <TextLink title="생체인증으로 해제" onPress={() => unlockWithBiometric()} />}
        <TextLink title="PIN을 잊으셨나요?" onPress={handleForgot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },
  title: { color: COLORS.white, fontSize: FONT.size.title, fontWeight: FONT.weight.extrabold, marginBottom: SPACING.sm },
  message: {
    color: COLORS.accentLavenderLight,
    fontSize: FONT.size.lg,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
  },
  links: { marginTop: SPACING.xl, alignItems: 'center' },
});
