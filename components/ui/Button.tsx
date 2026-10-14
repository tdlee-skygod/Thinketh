import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, GestureResponderEvent } from 'react-native';
import { COLORS, RADIUS, SPACING, FONT } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: (e: GestureResponderEvent) => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
}

export function Button({ title, onPress, loading, disabled, variant = 'primary', size = 'md' }: ButtonProps) {
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        size === 'sm' && styles.baseSm,
        isDanger ? styles.danger : isGhost ? styles.ghost : styles.primary,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isDanger ? COLORS.danger : isGhost ? COLORS.primary : COLORS.white} />
      ) : (
        <Text
          style={[
            styles.text,
            size === 'sm' && styles.textSm,
            isDanger ? styles.textDanger : isGhost ? styles.textGhost : styles.textPrimary,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseSm: {
    paddingVertical: SPACING.sm,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  danger: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: FONT.size.xl,
    fontWeight: FONT.weight.bold,
  },
  textSm: {
    fontSize: FONT.size.md,
  },
  textPrimary: {
    color: COLORS.white,
  },
  textGhost: {
    color: COLORS.primary,
  },
  textDanger: {
    color: COLORS.danger,
  },
});
