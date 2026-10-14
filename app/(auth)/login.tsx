import { useState } from 'react';
import { Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Link } from 'expo-router';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { COLORS, SPACING, FONT } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('입력 확인', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      console.error('[LoginScreen]', e);
      Alert.alert('로그인 실패', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>Thinketh</Text>
      <Text style={styles.subtitle}>As you thinketh, so you become</Text>

      <TextField
        label="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <TextField
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="********"
      />

      <Button title="로그인" onPress={handleSubmit} loading={isLoading} />

      <Link href="/(auth)/signup" style={styles.linkText}>
        계정이 없으신가요? 회원가입
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    backgroundColor: COLORS.bgLighter,
  },
  title: {
    fontSize: FONT.size.title,
    fontWeight: FONT.weight.extrabold,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT.size.sm,
    color: COLORS.accentLavender,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: SPACING.xxl * 2,
  },
  linkText: {
    marginTop: SPACING.lg,
    textAlign: 'center',
    color: COLORS.primaryLight,
    fontSize: FONT.size.md,
    fontWeight: FONT.weight.semibold,
  },
});
