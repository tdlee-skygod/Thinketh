import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useGoalEntryStore } from '@/store/useGoalEntryStore';
import { useGoalAspirationStore } from '@/store/useGoalAspirationStore';
import { useVoiceFocusStore } from '@/store/useVoiceFocusStore';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { MicIcon, BellIcon } from '@/components/ui/icons';
import { localDateStr } from '@/lib/date';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';

interface GoalLogModalProps {
  visible: boolean;
  onClose: () => void;
  mode: 'commitment' | 'aspiration';
  goalId: string;
  goalText: string;
}

const MAX_COMMITMENT_LENGTH = 1000;

// 스토어에 아직 데이터가 없을 때 매 렌더링마다 새 배열을 반환하면 참조가 계속 바뀌어
// useSyncExternalStore가 무한 재렌더링에 빠진다(Maximum update depth exceeded) — 고정 참조를 폴백으로 사용한다.
const EMPTY_LIST: never[] = [];

export function GoalLogModal({ visible, onClose, mode, goalId, goalText }: GoalLogModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const today = localDateStr();
  const voiceOwnerKey = `commitment-${goalId}`;
  const voiceOwnerId = useVoiceFocusStore((s) => s.ownerId);
  const claimVoice = useVoiceFocusStore((s) => s.claim);
  const releaseVoice = useVoiceFocusStore((s) => s.release);

  const commitmentEntries = useGoalEntryStore((s) => s.entriesByGoal[goalId] ?? EMPTY_LIST);
  const fetchEntries = useGoalEntryStore((s) => s.fetchEntries);
  const saveEntry = useGoalEntryStore((s) => s.saveEntry);
  const deleteEntry = useGoalEntryStore((s) => s.deleteEntry);

  const aspirationEntries = useGoalAspirationStore((s) => s.aspirationsByGoal[goalId] ?? EMPTY_LIST);
  const fetchAspirations = useGoalAspirationStore((s) => s.fetchAspirations);

  const isCommitment = mode === 'commitment';
  const dates = useMemo(() => {
    if (!isCommitment) return aspirationEntries.map((e) => e.date);
    const known = commitmentEntries.map((e) => e.date);
    return known.includes(today) ? known : [today, ...known];
  }, [isCommitment, commitmentEntries, aspirationEntries, today]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDraftFocused, setIsDraftFocused] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelectedDate(null);
    if (isCommitment) fetchEntries(goalId);
    else fetchAspirations(goalId);
  }, [visible, goalId, isCommitment, fetchEntries, fetchAspirations]);

  useEffect(() => {
    if (!visible || dates.length === 0) return;
    if (!selectedDate) setSelectedDate(dates[0]);
  }, [visible, dates, selectedDate]);

  useEffect(() => {
    if (!selectedDate) return;
    if (isCommitment) {
      const existing = commitmentEntries.find((e) => e.date === selectedDate);
      setDraft(existing?.content ?? '');
    } else {
      const existing = aspirationEntries.find((e) => e.date === selectedDate);
      setDraft(existing?.content ?? '');
    }
  }, [selectedDate, isCommitment, commitmentEntries, aspirationEntries]);

  // 다짐 입력창에 포커스가 있는 동안만 마이크를 활성화한다. voiceOwnerId도 함께 확인하는 이유:
  // 뒤로가기로 키보드만 닫는 등 blur 이벤트가 누락되는 경우에도, 다른 입력창(목표 입력창 등)이
  // 포커스를 가져가면 소유권이 즉시 넘어가 이 팝업의 음성 인식이 확실히 꺼지도록 하기 위함이다.
  const isDictating = visible && isCommitment && isDraftFocused && voiceOwnerId === voiceOwnerKey;

  useEffect(() => {
    if (!isDictating) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    ExpoSpeechRecognitionModule.requestPermissionsAsync().then((result) => {
      if (!result.granted) return;
      ExpoSpeechRecognitionModule.start({ lang: 'ko-KR', interimResults: true, continuous: true });
    });
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, [isDictating]);

  useSpeechRecognitionEvent('end', () => {
    // 침묵 등으로 인식이 종료되어도 포커스가 유지되는 동안은 계속 듣도록 재시작한다.
    if (isDictating) {
      ExpoSpeechRecognitionModule.start({ lang: 'ko-KR', interimResults: true, continuous: true });
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!isDictating) return;
    if (!event.isFinal) return;
    const transcript = event.results[0]?.transcript?.trim();
    if (!transcript) return;
    setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript).slice(0, MAX_COMMITMENT_LENGTH));
  });

  useEffect(() => {
    if (!visible) {
      Speech.stop();
      releaseVoice(voiceOwnerKey);
    }
  }, [visible, releaseVoice, voiceOwnerKey]);

  const handleSave = async () => {
    if (!selectedDate) return;
    setIsSaving(true);
    try {
      await saveEntry(goalId, selectedDate, draft.trim());
      setShowSavedToast(true);
    } catch (e) {
      console.error('[GoalLogModal]', e);
      Alert.alert('오류', '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleDelete = () => {
    if (!selectedDate) return;
    Alert.alert('다짐 삭제', '이 날짜의 다짐을 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          try {
            await deleteEntry(goalId, selectedDate);
            setSelectedDate(null);
          } catch (e) {
            console.error('[GoalLogModal]', e);
            Alert.alert('오류', '삭제 중 오류가 발생했습니다.');
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  const hasExistingEntry = !!selectedDate && commitmentEntries.some((e) => e.date === selectedDate);

  const handleReadAloud = () => {
    if (!draft) return;
    Speech.stop();
    Speech.speak(draft, { language: 'ko-KR', pitch: 1.0, rate: 1.0 });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { height: windowHeight * 0.8 }]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {isCommitment ? '다짐' : '열망'} · {goalText}
            </Text>
            <View style={styles.headerActions}>
              <Pressable style={styles.iconButton} onPress={handleReadAloud} hitSlop={8}>
                <BellIcon color={COLORS.primaryLight} size={18} />
              </Pressable>
              <View style={[styles.iconButton, isDictating && styles.iconButtonActive]}>
                <MicIcon color={isDictating ? COLORS.white : COLORS.textMuted} size={16} />
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.dateList}>
              <FlatList
                style={styles.dateListInner}
                data={dates}
                keyExtractor={(d) => d}
                ListEmptyComponent={<Text style={styles.empty}>등록된 기록이 없어요</Text>}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.dateRow, item === selectedDate && styles.dateRowActive]}
                    onPress={() => setSelectedDate(item)}
                  >
                    <Text
                      style={[styles.dateText, item === selectedDate && styles.dateTextActive]}
                      numberOfLines={1}
                    >
                      {item}
                    </Text>
                  </Pressable>
                )}
              />
            </View>

            <View style={styles.detail}>
              {isCommitment ? (
                <TextInput
                  value={draft}
                  onChangeText={(v) => setDraft(v.slice(0, MAX_COMMITMENT_LENGTH))}
                  onFocus={() => {
                    setIsDraftFocused(true);
                    claimVoice(voiceOwnerKey);
                  }}
                  onBlur={() => {
                    setIsDraftFocused(false);
                    releaseVoice(voiceOwnerKey);
                  }}
                  placeholder="오늘의 다짐을 적어보세요..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  maxLength={MAX_COMMITMENT_LENGTH}
                  style={styles.textarea}
                  editable={!!selectedDate}
                />
              ) : (
                <Text style={styles.readOnlyText}>{draft || '아직 기록된 열망이 없어요'}</Text>
              )}
            </View>
          </View>

          {isCommitment && (
            <View style={styles.footer}>
              <View style={styles.footerButton}>
                <Button title="취소" variant="ghost" size="sm" onPress={handleCancel} />
              </View>
              <View style={styles.footerButton}>
                <Button title="저장" size="sm" onPress={handleSave} loading={isSaving} disabled={!selectedDate} />
              </View>
              <View style={styles.footerButton}>
                <Button
                  title="삭제"
                  variant="danger"
                  size="sm"
                  onPress={handleDelete}
                  loading={isDeleting}
                  disabled={!hasExistingEntry}
                />
              </View>
            </View>
          )}

          <Toast
            visible={showSavedToast}
            message="✦ 다짐이 저장됐어요!"
            onHide={() => setShowSavedToast(false)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30,27,75,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: { flex: 1, fontSize: FONT.size.xl, fontWeight: FONT.weight.extrabold, color: COLORS.primaryDark },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgLight,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  close: { fontSize: FONT.size.xl, color: COLORS.primaryLight, marginLeft: SPACING.xs },
  body: { flex: 1, flexDirection: 'row', gap: SPACING.md },
  dateList: { width: 100, flexGrow: 0, flexShrink: 0, borderRightWidth: 1, borderRightColor: COLORS.borderLight },
  dateListInner: { flex: 1 },
  empty: { textAlign: 'center', color: COLORS.textMuted, padding: SPACING.lg, fontSize: FONT.size.sm },
  dateRow: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.xs, borderRadius: RADIUS.sm },
  dateRowActive: { backgroundColor: COLORS.bgLight },
  dateText: { fontSize: FONT.size.sm, color: COLORS.textMuted },
  dateTextActive: { color: COLORS.primary, fontWeight: FONT.weight.bold },
  detail: { flex: 1, paddingLeft: SPACING.sm },
  textarea: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT.size.lg,
    color: COLORS.textDark,
    textAlignVertical: 'top',
  },
  readOnlyText: { fontSize: FONT.size.lg, color: COLORS.textDark, lineHeight: 22 },
  footer: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  footerButton: { flex: 1 },
});
