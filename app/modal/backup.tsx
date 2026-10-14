import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useBackupStore } from '@/store/useBackupStore';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { BackupError, MIN_PASSWORD_LENGTH } from '@/lib/backupCrypto';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';
import type { BackupMode } from '@/types';

function errorMessage(e: unknown): string {
  return e instanceof BackupError ? e.message : '처리 중 오류가 발생했어요. 다시 시도해 주세요.';
}

// 내보내기/가져오기 (F-25, D-237). 비밀번호는 입력 상태에만 두고 처리가 끝나면 지운다.
export default function BackupModal() {
  const router = useRouter();
  const isBusy = useBackupStore((s) => s.isBusy);
  const exportBackup = useBackupStore((s) => s.exportBackup);
  const importBackup = useBackupStore((s) => s.importBackup);

  const [exportPw, setExportPw] = useState('');
  const [exportPw2, setExportPw2] = useState('');
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState('');
  const [importPw, setImportPw] = useState('');
  const [mode, setMode] = useState<BackupMode>('merge');

  const handleExport = async () => {
    if (exportPw.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('입력 확인', `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상으로 정해 주세요.`);
      return;
    }
    if (exportPw !== exportPw2) {
      Alert.alert('입력 확인', '비밀번호 두 개가 서로 달라요.');
      return;
    }
    try {
      await exportBackup(exportPw);
      Alert.alert('내보내기 완료', '공유 화면에서 파일을 안전한 곳(드라이브, 다른 기기 등)에 저장했는지 확인해 주세요.');
    } catch (e) {
      Alert.alert('내보내기 실패', errorMessage(e));
    } finally {
      setExportPw('');
      setExportPw2('');
    }
  };

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled || result.assets.length === 0) return;
      setPickedUri(result.assets[0].uri);
      setPickedName(result.assets[0].name);
    } catch {
      Alert.alert('오류', '파일을 선택하지 못했어요.');
    }
  };

  const runImport = async () => {
    if (!pickedUri) return;
    try {
      const summary = await importBackup(pickedUri, importPw, mode);
      const detail =
        summary.mode === 'overwrite'
          ? `기록 ${summary.added}건을 포함해 모든 데이터를 백업 내용으로 바꿨어요.`
          : `새 기록 ${summary.added}건 추가, ${summary.updated}건 갱신했어요. 지난 날짜 기록 ${summary.skippedPast}건은 건너뛰었어요.`;
      Alert.alert('가져오기 완료', detail, [{ text: '확인', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('가져오기 실패', errorMessage(e));
    } finally {
      setImportPw('');
    }
  };

  const handleImport = () => {
    if (!pickedUri) {
      Alert.alert('입력 확인', '먼저 백업 파일을 선택해 주세요.');
      return;
    }
    if (importPw.length === 0) {
      Alert.alert('입력 확인', '백업 비밀번호를 입력해 주세요.');
      return;
    }
    if (mode === 'overwrite') {
      Alert.alert('덮어쓰기', '지금 이 폰의 모든 기록과 설정이 지워지고 백업 내용으로 바뀌어요. 계속할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '덮어쓰기', style: 'destructive', onPress: runImport },
      ]);
      return;
    }
    runImport();
  };

  return (
    <SafeAreaView style={styles.sheet} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Text style={styles.title}>백업</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.notice}>
            이 앱의 데이터는 이 폰에만 있어요. 앱을 지우거나 폰을 바꾸면 사라지니, 비밀번호로 보호된 백업 파일을 만들어 두세요.
          </Text>

          <Text style={styles.sectionTitle}>내보내기</Text>
          <Text style={styles.hint}>비밀번호를 잊으면 백업 파일을 열 수 없어요. 비밀번호는 어디에도 저장되지 않아요.</Text>
          <TextField
            label={`백업 비밀번호 (${MIN_PASSWORD_LENGTH}자 이상)`}
            value={exportPw}
            onChangeText={setExportPw}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            label="비밀번호 확인"
            value={exportPw2}
            onChangeText={setExportPw2}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button title="백업 파일 만들기" onPress={handleExport} loading={isBusy} />

          <Text style={[styles.sectionTitle, styles.sectionGap]}>가져오기</Text>
          <Button title={pickedName ? `선택됨: ${pickedName}` : '백업 파일 선택'} variant="ghost" onPress={handlePick} disabled={isBusy} />
          <View style={styles.spacer} />
          <TextField
            label="백업 비밀번호"
            value={importPw}
            onChangeText={setImportPw}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>가져오는 방식</Text>
          <View style={styles.modeRow}>
            <Pressable style={[styles.modeBox, mode === 'merge' && styles.modeBoxActive]} onPress={() => setMode('merge')}>
              <Text style={[styles.modeTitle, mode === 'merge' && styles.modeTitleActive]}>병합</Text>
              <Text style={styles.modeDesc}>오늘 이후 기록만 합쳐요. 지난 날짜는 그대로 둬요.</Text>
            </Pressable>
            <Pressable style={[styles.modeBox, mode === 'overwrite' && styles.modeBoxActive]} onPress={() => setMode('overwrite')}>
              <Text style={[styles.modeTitle, mode === 'overwrite' && styles.modeTitleActive]}>덮어쓰기</Text>
              <Text style={styles.modeDesc}>모두 지우고 백업으로 바꿔요. 새 폰 복원에 써요.</Text>
            </Pressable>
          </View>
          <Button title="가져오기" onPress={handleImport} loading={isBusy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: COLORS.white, padding: SPACING.xl },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  title: { fontSize: FONT.size.xl, fontWeight: FONT.weight.extrabold, color: COLORS.primaryDark },
  close: { fontSize: FONT.size.xl, color: COLORS.primaryLight },
  notice: {
    backgroundColor: COLORS.bgLight,
    color: COLORS.textDark,
    fontSize: FONT.size.md,
    lineHeight: 18,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
  },
  sectionTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.extrabold, color: COLORS.primaryDark, marginBottom: SPACING.sm },
  sectionGap: { marginTop: SPACING.xxl },
  hint: { fontSize: FONT.size.md, color: COLORS.textMuted, lineHeight: 18, marginBottom: SPACING.md },
  label: { fontSize: FONT.size.sm, color: COLORS.accentLavender, fontWeight: FONT.weight.bold, marginBottom: SPACING.sm },
  spacer: { height: SPACING.lg },
  modeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  modeBox: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  modeBoxActive: { borderColor: COLORS.primary, backgroundColor: COLORS.bgLight },
  modeTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, color: COLORS.textDark },
  modeTitleActive: { color: COLORS.primary },
  modeDesc: { fontSize: FONT.size.xs, color: COLORS.textMuted, marginTop: SPACING.xs, lineHeight: 14 },
});
