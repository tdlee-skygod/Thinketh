import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { COLORS, RADIUS, SPACING, FONT } from '@/constants/theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: boolean;
}

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={COLORS.textMuted}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT.size.sm,
    color: COLORS.accentLavender,
    fontWeight: FONT.weight.bold,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.bgLight,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT.size.lg,
    color: COLORS.textDark,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
});
