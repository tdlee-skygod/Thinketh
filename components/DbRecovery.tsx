import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { TextLink } from '@/components/lock/TextLink';
import * as DocumentPicker from 'expo-document-picker';
import { archiveDbFiles, openDb } from '@/lib/localDb';
import { applyImport, prepareImport } from '@/lib/backup';
import { BackupError } from '@/lib/backupCrypto';
import { COLORS, FONT, RADIUS, SPACING } from '@/constants/theme';
import type { DbOpenResult } from '@/types';

type FailedResult = Extract<DbOpenResult, { ok: false }>;

interface DbRecoveryProps {
  reason: FailedResult['reason'];
  onRetry: () => void;   // DB 열기를 다시 시도한다
}

const CONFIRM_WORD = '삭제';

// DB를 열 수 없을 때의 안내 화면 (D-253). 어떤 경우에도 DB 파일을 자동으로 지우지 않는다.
export function DbRecovery({ reason, onRetry }: DbRecoveryProps) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState('');
  const [password, setPassword] = useState('');

  const startFresh = async () => {
    setBusy(true);
    try {
      await archiveDbFiles();
      onRetry();
    } catch {
      setBusy(false);
      Alert.alert('오류', '기존 데이터 파일을 보존하지 못해 새로 시작하지 않았어요.');
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled || result.assets.length === 0) return;
      setPickedUri(result.assets[0].uri);
      setPickedName(result.assets[0].name);
    } catch {
      Alert.alert('오류', '파일을 선택하지 못했어요.');
    }
  };

  // 순서: 파일 복호화·검증(DB 무관) → 통과하면 기존 DB 파일 보존(이름 변경) → 새 DB 열기 → 덮어쓰기 반영.
  // 검증에 실패하면 기존 파일을 건드리지 않는다. 이 화면은 DB가 닫혀 있어 스토어를 쓸 수 없어 lib을 직접 호출한다(복구 화면의 예외).
  const importFromBackup = async () => {
    if (!pickedUri || password.length === 0) {
      Alert.alert('입력 확인', '백업 파일과 비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const payload = await prepareImport(pickedUri, password);
      await archiveDbFiles();
      const opened = await openDb();
      if (!opened.ok) throw new Error('open_failed');
      await applyImport(payload, 'overwrite');
      onRetry();
    } catch (e) {
      setBusy(false);
      Alert.alert(
        '가져오기 실패',
        e instanceof BackupError ? e.message : '복원하지 못했어요. 기존 데이터 파일은 보관되어 있어요.'
      );
    } finally {
      setPassword('');
    }
  };

  if (reason === 'newer_version') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>앱을 업데이트해 주세요</Text>
        <Text style={styles.body}>
          이 데이터는 더 새로운 버전의 앱에서 만들어졌어요. 데이터를 보호하기 위해 열지 않았어요. 앱을 최신 버전으로 업데이트해 주세요.
        </Text>
      </View>
    );
  }

  if (reason === 'transient') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>잠시 문제가 생겼어요</Text>
        <Text style={styles.body}>저장된 데이터를 여는 중 일시적인 오류가 있었어요. 다시 시도해 주세요.</Text>
        <Button title="다시 시도" onPress={onRetry} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>저장된 데이터를 열 수 없어요</Text>
      <Text style={styles.body}>
        {reason === 'corrupted'
          ? '데이터 파일이 손상되었을 수 있어요.'
          : '앱을 지우거나 데이터를 삭제하면 암호 키가 사라져 이전 데이터를 열 수 없어요.'}
        {'\n\n'}새로 시작해도 기존 파일은 지우지 않고 보관해 둬요.
      </Text>
      {importing ? (
        <View style={styles.confirm}>
          <TextLink title={pickedName ? `선택됨: ${pickedName}` : '백업 파일 선택'} onPress={pickFile} disabled={busy} />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="백업 비밀번호"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button title="백업에서 가져오기" onPress={importFromBackup} loading={busy} />
          <TextLink title="취소" onPress={() => { setImporting(false); setPickedUri(null); setPickedName(''); setPassword(''); }} disabled={busy} />
        </View>
      ) : !confirming ? (
        <View style={styles.confirm}>
          <Button title="백업에서 가져오기" onPress={() => setImporting(true)} />
          <TextLink title="새로 시작" onPress={() => setConfirming(true)} />
        </View>
      ) : (
        <View style={styles.confirm}>
          <Text style={styles.body}>새로 시작하려면 아래에 "{CONFIRM_WORD}"를 입력해 주세요.</Text>
          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={setTyped}
            placeholder={CONFIRM_WORD}
            placeholderTextColor={COLORS.textMuted}
            autoCorrect={false}
          />
          <Button title="새로 시작" onPress={startFresh} loading={busy} disabled={typed.trim() !== CONFIRM_WORD} />
          <TextLink title="취소" onPress={() => { setConfirming(false); setTyped(''); }} disabled={busy} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center',
    padding: SPACING.xxl,
    gap: SPACING.lg,
  },
  title: { color: COLORS.white, fontSize: FONT.size.title, fontWeight: FONT.weight.extrabold },
  body: { color: COLORS.accentLavenderLight, fontSize: FONT.size.xl, lineHeight: 22 },
  confirm: { gap: SPACING.md },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    fontSize: FONT.size.xl,
    color: COLORS.textDark,
  },
});
