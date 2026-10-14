import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT, RADIUS, SPACING } from '@/constants/theme';
import { PIN_LENGTH } from '@/lib/pin';

const KEY_SIZE = 72;
const DOT_SIZE = 14;
const SHAKE_DISTANCE = 10;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

interface PinPadProps {
  onComplete: (pin: string) => void;
  disabled?: boolean;
  errorSignal?: number; // 값이 바뀔 때마다 흔들림 + 입력 초기화
}

// 6자리 PIN 입력 키패드. 입력값은 이 컴포넌트 안에만 있고 완성되는 즉시 onComplete로 넘긴 뒤 지운다 (D-244).
export function PinPad({ onComplete, disabled, errorSignal }: PinPadProps) {
  const [digits, setDigits] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!errorSignal) return;
    setDigits('');
    Animated.sequence([
      Animated.timing(shake, { toValue: SHAKE_DISTANCE, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -SHAKE_DISTANCE, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: SHAKE_DISTANCE, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [errorSignal, shake]);

  const press = (key: string) => {
    if (disabled || key === '') return;
    if (key === '⌫') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    const next = digits + key;
    if (next.length < PIN_LENGTH) {
      setDigits(next);
      return;
    }
    setDigits('');
    onComplete(next);
  };

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.dots, { transform: [{ translateX: shake }] }]}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, i < digits.length && styles.dotFilled]} />
        ))}
      </Animated.View>
      <View style={styles.grid}>
        {KEYS.map((key, i) => (
          <Pressable
            key={i}
            style={[styles.key, key === '' && styles.keyEmpty]}
            onPress={() => press(key)}
            disabled={disabled || key === ''}
          >
            <Text style={styles.keyText}>{key}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  dots: { flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.xxl },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1.5,
    borderColor: COLORS.accentLavenderLight,
  },
  dotFilled: { backgroundColor: COLORS.accentLavenderLight },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: KEY_SIZE * 3 + SPACING.lg * 4, justifyContent: 'center', gap: SPACING.lg },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: { backgroundColor: 'transparent' },
  keyText: { fontSize: FONT.size.title, color: COLORS.textDark, fontWeight: FONT.weight.semibold },
});
