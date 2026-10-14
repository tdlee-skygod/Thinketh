import { Pressable, StyleSheet, Text } from 'react-native';
import { COLORS, FONT, SPACING } from '@/constants/theme';

interface TextLinkProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

// 어두운 배경(잠금·복구 화면)에서 쓰는 보조 링크 버튼
export function TextLink({ title, onPress, disabled }: TextLinkProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.base, disabled && styles.disabled]}>
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  text: { color: COLORS.accentLavenderLight, fontSize: FONT.size.lg, textDecorationLine: 'underline' },
});
