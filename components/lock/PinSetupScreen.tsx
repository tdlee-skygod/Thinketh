import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { PinPad } from '@/components/lock/PinPad';
import { TextLink } from '@/components/lock/TextLink';
import { isBiometricAvailable } from '@/store/useLockStore';
import { COLORS, FONT, SPACING } from '@/constants/theme';

interface PinSetupScreenProps {
  title: string;
  askBiometric?: boolean;                                                  // 첫 설정 때만 생체인증 사용 여부를 묻는다
  onSubmit: (pin: string, enableBiometric: boolean) => Promise<void>;
  onCancel?: () => void;
}

type Step = 'enter' | 'confirm' | 'biometric';

// PIN 6자리를 두 번 입력받는다(D-235). 일치하지 않으면 처음부터 다시 입력한다.
export function PinSetupScreen({ title, askBiometric, onSubmit, onCancel }: PinSetupScreenProps) {
  const [step, setStep] = useState<Step>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [errorSignal, setErrorSignal] = useState(0);
  const [message, setMessage] = useState('사용할 PIN 6자리를 입력해 주세요');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  const submit = async (pin: string, enableBiometric: boolean) => {
    setSaving(true);
    try {
      await onSubmit(pin, enableBiometric);
    } catch {
      setSaving(false);
      setStep('enter');
      setFirstPin('');
      setMessage('저장하지 못했어요. 다시 입력해 주세요');
      setErrorSignal((n) => n + 1);
    }
  };

  const handleComplete = (pin: string) => {
    if (step === 'enter') {
      setFirstPin(pin);
      setStep('confirm');
      setMessage('확인을 위해 한 번 더 입력해 주세요');
      return;
    }
    if (pin !== firstPin) {
      setFirstPin('');
      setStep('enter');
      setMessage('PIN이 일치하지 않아요. 처음부터 다시 입력해 주세요');
      setErrorSignal((n) => n + 1);
      return;
    }
    if (askBiometric && biometricAvailable) {
      setFirstPin(pin);
      setStep('biometric');
      return;
    }
    submit(pin, false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {step === 'biometric' ? (
        <View style={styles.biometric}>
          <Text style={styles.message}>생체인증으로도 잠금을 해제할까요?</Text>
          <Button title="생체인증 사용" onPress={() => submit(firstPin, true)} loading={saving} />
          <TextLink title="PIN만 사용" onPress={() => submit(firstPin, false)} disabled={saving} />
        </View>
      ) : (
        <>
          <Text style={styles.message}>{message}</Text>
          <PinPad onComplete={handleComplete} disabled={saving} errorSignal={errorSignal} />
          {onCancel && (
            <View style={styles.cancel}>
              <TextLink title="취소" onPress={onCancel} />
            </View>
          )}
        </>
      )}
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
  biometric: { width: '100%', gap: SPACING.md },
  cancel: { marginTop: SPACING.xl },
});
