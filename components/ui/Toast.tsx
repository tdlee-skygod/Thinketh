import { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';

interface ToastProps {
  visible: boolean;
  message: string;
  onHide: () => void;
  duration?: number;
}

// 목업(thinketh_mockup.html)의 "✦ 문구가 등록됐어요!" 토스트 스타일을 따른다 (ux-patterns.md § 토스트).
export function Toast({ visible, message, onHide, duration = 1800 }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onHide, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onHide]);

  if (!visible) return null;

  return (
    <Text style={styles.toast} pointerEvents="none">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: SPACING.xxl,
    alignSelf: 'center',
    backgroundColor: COLORS.primaryDark,
    color: COLORS.accentLavenderLight,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    fontSize: FONT.size.sm,
    fontWeight: FONT.weight.semibold,
    overflow: 'hidden',
  },
});
