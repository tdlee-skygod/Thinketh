import { useState } from 'react';
import { Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { COLORS, SPACING, FONT } from '@/constants/theme';

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleSubmit = async () => {
    if (!email.trim() || !password || !displayName.trim()) {
      Alert.alert('입력 확인', '이름, 이메일, 비밀번호를 모두 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('입력 확인', '비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    try {
      const { needsEmailConfirmation } = await signUp(email.trim(), password, displayName.trim());
      if (needsEmailConfirmation) {
        Alert.alert('이메일을 확인해주세요', '가입하신 이메일로 인증 링크를 보냈습니다. 인증 후 로그인해주세요.');
        router.replace('/(auth)/login');
      }
    } catch (e) {
      console.error('[SignupScreen]', e);
      Alert.alert('회원가입 실패', e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>회원가입</Text>

      <TextField label="이름" value={displayName} onChangeText={setDisplayName} placeholder="닉네임" />
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
        placeholder="6자 이상"
      />

      <Button title="가입하기" onPress={handleSubmit} loading={isLoading} />

      <Link href="/(auth)/login" style={styles.linkText}>
        이미 계정이 있으신가요? 로그인
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
    fontSize: FONT.size.xxl,
    fontWeight: FONT.weight.extrabold,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
  },
  linkText: {
    marginTop: SPACING.lg,
    textAlign: 'center',
    color: COLORS.primaryLight,
    fontSize: FONT.size.md,
    fontWeight: FONT.weight.semibold,
  },
});
