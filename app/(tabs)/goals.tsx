import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, Alert, Modal } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useGoalCategoryStore } from '@/store/useGoalCategoryStore';
import { useGoalStore } from '@/store/useGoalStore';
import { useGoalEntryStore } from '@/store/useGoalEntryStore';
import { useVoiceFocusStore } from '@/store/useVoiceFocusStore';
import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { CategorySelect } from '@/components/goal/CategorySelect';
import { GoalListItem } from '@/components/goal/GoalListItem';
import { MicIcon } from '@/components/ui/icons';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';
import type { Goal } from '@/types';

const MAX_GOAL_LENGTH = 300;
const GOAL_VOICE_OWNER = 'goal-input';

export default function GoalsScreen() {
  const { categories, fetchGoalCategories, addGoalCategory, deleteGoalCategory } = useGoalCategoryStore();
  const { goals, fetchGoals, addGoal, updateGoal } = useGoalStore();
  const fetchEntryCounts = useGoalEntryStore((s) => s.fetchEntryCounts);
  const voiceOwnerId = useVoiceFocusStore((s) => s.ownerId);
  const claimVoice = useVoiceFocusStore((s) => s.claim);
  const releaseVoice = useVoiceFocusStore((s) => s.release);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [goalText, setGoalText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [isGoalInputFocused, setIsGoalInputFocused] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  useEffect(() => {
    fetchGoalCategories();
    fetchGoals();
    fetchEntryCounts();
  }, [fetchGoalCategories, fetchGoals, fetchEntryCounts]);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  // 목표 입력창에 포커스가 있는 동안만 마이크를 활성화한다. 포커스 상태(isGoalInputFocused)뿐
  // 아니라 voiceOwnerId도 함께 확인하는 이유: 뒤로가기로 키보드만 닫는 등 blur 이벤트가
  // 누락되는 경우에도, 다른 입력창(예: 다짐 팝업)이 포커스를 가져가면 소유권이 즉시 넘어가
  // 이 입력창의 음성 인식이 확실히 꺼지도록 하기 위함이다.
  const isDictatingGoal = micActive && isGoalInputFocused && voiceOwnerId === GOAL_VOICE_OWNER;

  const startVoiceInput = async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      setMicActive(false);
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: 'ko-KR', interimResults: true, continuous: true });
  };

  useEffect(() => {
    if (!isDictatingGoal) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    startVoiceInput();
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, [isDictatingGoal]);

  useSpeechRecognitionEvent('result', (event) => {
    if (!isDictatingGoal || !event.isFinal) return;
    const transcript = event.results[0]?.transcript?.trim();
    if (!transcript) return;
    setGoalText((prev) => (prev ? `${prev} ${transcript}` : transcript).slice(0, MAX_GOAL_LENGTH));
  });

  useSpeechRecognitionEvent('end', () => {
    if (isDictatingGoal) startVoiceInput();
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'not-allowed') setMicActive(false);
  });

  const toggleMic = () => setMicActive((prev) => !prev);

  const goalsInCategory = useMemo(
    () => goals.filter((g) => g.categoryId === selectedCategoryId),
    [goals, selectedCategoryId]
  );

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('입력 확인', '카테고리 이름을 입력해주세요.');
      return;
    }
    try {
      await addGoalCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (e) {
      console.error('[GoalsScreen]', e);
      Alert.alert('오류', '카테고리 추가 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteCategory = () => {
    if (!selectedCategoryId) return;
    const category = categories.find((c) => c.id === selectedCategoryId);
    if (!category) return;

    Alert.alert('카테고리 삭제', `"${category.name}" 카테고리를 삭제하시겠어요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const ok = await deleteGoalCategory(category.id);
            if (!ok) {
              Alert.alert('삭제 불가', '이 카테고리에 등록된 목표가 있어 삭제할 수 없습니다.');
              return;
            }
            setSelectedCategoryId(null);
          } catch (e) {
            console.error('[GoalsScreen]', e);
            Alert.alert('오류', '삭제 중 오류가 발생했습니다.');
          }
        },
      },
    ]);
  };

  const handleSaveGoal = async () => {
    if (!selectedCategoryId) {
      Alert.alert('입력 확인', '카테고리를 먼저 선택해주세요.');
      return;
    }
    if (!goalText.trim()) {
      Alert.alert('입력 확인', '목표 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingGoalId) {
        await updateGoal(editingGoalId, goalText.trim());
        setEditingGoalId(null);
      } else {
        await addGoal(selectedCategoryId, goalText.trim());
      }
      setGoalText('');
    } catch (e) {
      console.error('[GoalsScreen]', e);
      Alert.alert('오류', editingGoalId ? '목표 수정 중 오류가 발생했습니다.' : '목표 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setGoalText(goal.text);
  };

  const handleCancelEditGoal = () => {
    setEditingGoalId(null);
    setGoalText('');
  };

  return (
    <View style={styles.container}>
      <AppHeader />

      <View style={styles.content}>
        <View style={styles.categoryRow}>
          <CategorySelect
            categories={categories}
            selectedId={selectedCategoryId}
            onSelect={(id) => {
              setSelectedCategoryId(id);
              handleCancelEditGoal();
            }}
          />
          <Pressable style={styles.squareButton} onPress={() => setIsAddingCategory(true)}>
            <Text style={styles.squareButtonText}>+</Text>
          </Pressable>
          <Pressable
            style={[styles.squareButton, !selectedCategoryId && styles.squareButtonDisabled]}
            onPress={handleDeleteCategory}
            disabled={!selectedCategoryId}
          >
            <Text style={styles.squareButtonText}>−</Text>
          </Pressable>
        </View>

        <View style={styles.goalLabelRow}>
          <Text style={styles.label}>{editingGoalId ? '목표 수정 중' : '목표'}</Text>
          <View style={styles.goalLabelActions}>
            {editingGoalId && (
              <Pressable onPress={handleCancelEditGoal} hitSlop={8}>
                <Text style={styles.editCancelText}>취소</Text>
              </Pressable>
            )}
            <Pressable style={styles.saveButton} onPress={handleSaveGoal} disabled={isSubmitting}>
              <Text style={styles.saveButtonText}>
                {isSubmitting ? (editingGoalId ? '수정 중...' : '저장 중...') : editingGoalId ? '수정' : '저장'}
              </Text>
            </Pressable>
            <Pressable
              onPress={toggleMic}
              hitSlop={8}
              style={[styles.micButton, micActive && styles.micButtonActive]}
            >
              <MicIcon color={micActive ? COLORS.white : COLORS.accentLavender} size={16} />
            </Pressable>
          </View>
        </View>
        <TextInput
          value={goalText}
          onChangeText={(v) => setGoalText(v.slice(0, MAX_GOAL_LENGTH))}
          onFocus={() => {
            setIsGoalInputFocused(true);
            claimVoice(GOAL_VOICE_OWNER);
          }}
          onBlur={() => {
            setIsGoalInputFocused(false);
            releaseVoice(GOAL_VOICE_OWNER);
          }}
          placeholder="이루고 싶은 목표를 적어보세요..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={MAX_GOAL_LENGTH}
          style={styles.textarea}
        />
        <Text style={styles.counter}>{goalText.length}/{MAX_GOAL_LENGTH}</Text>

        <FlatList
          data={goalsInCategory}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {selectedCategoryId ? '아직 등록한 목표가 없어요' : '카테고리를 먼저 선택하거나 추가해주세요'}
            </Text>
          }
          renderItem={({ item }) => (
            <GoalListItem goal={item} isEditing={item.id === editingGoalId} onEdit={handleStartEditGoal} />
          )}
        />
      </View>

      <Modal visible={isAddingCategory} transparent animationType="fade" onRequestClose={() => setIsAddingCategory(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsAddingCategory(false)}>
          <Pressable style={styles.addCategoryCard} onPress={() => {}}>
            <Text style={styles.addCategoryTitle}>새 카테고리</Text>
            <TextInput
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="카테고리 이름"
              placeholderTextColor={COLORS.textMuted}
              style={styles.addCategoryInput}
              autoFocus
            />
            <View style={styles.addCategoryActions}>
              <View style={styles.addCategoryButton}>
                <Button title="취소" variant="ghost" onPress={() => setIsAddingCategory(false)} />
              </View>
              <View style={styles.addCategoryButton}>
                <Button title="추가" onPress={handleAddCategory} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgLighter },
  content: { flex: 1, paddingHorizontal: SPACING.lg },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  squareButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareButtonDisabled: { opacity: 0.4 },
  squareButtonText: { fontSize: FONT.size.xl, color: COLORS.primary, fontWeight: FONT.weight.bold },
  goalLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  label: { fontSize: FONT.size.sm, color: COLORS.accentLavender, fontWeight: FONT.weight.bold },
  goalLabelActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  editCancelText: { fontSize: FONT.size.sm, color: COLORS.textMuted, fontWeight: FONT.weight.semibold },
  saveButton: {
    height: 28,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: COLORS.white, fontSize: FONT.size.xs, fontWeight: FONT.weight.bold },
  micButton: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgLight,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  textarea: {
    height: 90,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT.size.lg,
    color: COLORS.textDark,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontSize: FONT.size.xs, color: COLORS.textMuted, marginTop: 4 },
  list: { paddingTop: SPACING.lg, paddingBottom: SPACING.xxl },
  empty: { textAlign: 'center', color: COLORS.textMuted, fontSize: FONT.size.md, marginTop: SPACING.xxl },
  backdrop: { flex: 1, backgroundColor: 'rgba(30,27,75,0.4)', alignItems: 'center', justifyContent: 'center' },
  addCategoryCard: {
    width: '85%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
  },
  addCategoryTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.extrabold, color: COLORS.primaryDark, marginBottom: SPACING.lg },
  addCategoryInput: {
    backgroundColor: COLORS.bgLight,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT.size.lg,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  addCategoryActions: { flexDirection: 'row', gap: SPACING.md },
  addCategoryButton: { flex: 1 },
});
