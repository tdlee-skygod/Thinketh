import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PinPad } from '@/components/lock/PinPad';
import { PinSetupScreen } from '@/components/lock/PinSetupScreen';
import { TextLink } from '@/components/lock/TextLink';
import { useLockStore } from '@/store/useLockStore';
import { COLORS, FONT, SPACING } from '@/constants/theme';

// PIN 변경 (F-23): 현재 PIN을 먼저 확인한 뒤 새 PIN을 두 번 입력받는다.
export default function PinChangeModal() {
  const router = useRouter();
  const checkPin = useLockStore((s) => s.checkPin);
  const changePin = useLockStore((s) => s.changePin);

  const [verified, setVerified] = useState(false);
  const [errorSignal, setErrorSignal] = useState(0);
  const [message, setMessage] = useState('현재 PIN을 입력해 주세요');
  const [checking, setChecking] = useState(false);

  if (verified) {
    return (
      <PinSetupScreen
        title="새 PIN 설정"
        onSubmit={async (pin) => {
          await changePin(pin);
          router.back();
        }}
        onCancel={() => router.back()}
      />
    );
  }

  const handleComplete = async (pin: string) => {
    setChecking(true);
    try {
      const result = await checkPin(pin);
      if (result === 'ok') {
        setVerified(true);
      } else {
        setMessage(result === 'wait' ? '여러 번 틀려 잠시 대기해야 해요. 잠시 후 다시 시도해 주세요' : 'PIN이 달라요');
        setErrorSignal((n) => n + 1);
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PIN 변경</Text>
      <Text style={styles.message}>{message}</Text>
      <PinPad onComplete={handleComplete} disabled={checking} errorSignal={errorSignal} />
      <View style={styles.cancel}>
        <TextLink title="취소" onPress={() => router.back()} />
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
  message: { color: COLORS.accentLavenderLight, fontSize: FONT.size.lg, textAlign: 'center', marginBottom: SPACING.xxl },
  cancel: { marginTop: SPACING.xl },
});
