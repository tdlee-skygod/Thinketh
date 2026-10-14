import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTimeStore } from '@/store/useTimeStore';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { TrashIcon } from '@/components/ui/icons';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';
import type { TimeLog } from '@/types';

export default function TimeLogModal() {
  const router = useRouter();
  const recentLogs = useTimeStore((s) => s.recentLogs);
  const fetchRecentLogs = useTimeStore((s) => s.fetchRecentLogs);
  const addTimeLog = useTimeStore((s) => s.addTimeLog);
  const updateTimeLog = useTimeStore((s) => s.updateTimeLog);
  const deleteTimeLog = useTimeStore((s) => s.deleteTimeLog);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [hoursText, setHoursText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentLogs();
  }, [fetchRecentLogs]);

  const handleSelectLog = (log: TimeLog) => {
    setEditingId(log.id);
    setTitle(log.title);
    setContent(log.content);
    setHoursText(String(log.hours));
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setHoursText('');
  };

  const handleSubmit = async () => {
    const hours = Number(hoursText);
    if (!title.trim()) {
      Alert.alert('입력 확인', '제목을 입력해주세요.');
      return;
    }
    if (!hoursText || Number.isNaN(hours) || hours <= 0) {
      Alert.alert('입력 확인', '시간을 0보다 큰 숫자로 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateTimeLog(editingId, title.trim(), content.trim(), hours);
      } else {
        await addTimeLog(title.trim(), content.trim(), hours);
      }
      router.back();
    } catch (e) {
      console.error('[TimeLogModal]', e);
      Alert.alert('오류', '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLog = (log: TimeLog) => {
    Alert.alert('기록 삭제', `"${log.title}" 기록을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(log.id);
          try {
            await deleteTimeLog(log.id);
            if (editingId === log.id) resetForm();
          } catch (e) {
            console.error('[TimeLogModal] deleteTimeLog', e);
            Alert.alert('오류', '삭제 중 오류가 발생했습니다.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.sheet} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{editingId ? '기록 수정' : '오늘 의미있었던 일'}</Text>
          <View style={styles.headerActions}>
            <View style={styles.saveButtonWrap}>
              <Button
                title={editingId ? '수정하기' : '저장하기'}
                onPress={handleSubmit}
                loading={isSubmitting}
                size="sm"
              />
            </View>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.flex1} keyboardShouldPersistTaps="handled">
          {editingId && (
            <Pressable onPress={resetForm} hitSlop={8} style={styles.newEntryLink}>
              <Text style={styles.newEntryLinkText}>+ 새로 작성</Text>
            </Pressable>
          )}

          <TextField
            label="제목"
            value={title}
            onChangeText={setTitle}
            placeholder="예: 아침 운동"
          />

          <Text style={styles.label}>내용</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="어떤 의미가 있었는지 적어주세요..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            style={styles.textarea}
          />

          <TextField
            label="시간 (시간 단위, 예: 1.5)"
            value={hoursText}
            onChangeText={setHoursText}
            placeholder="예: 2"
            keyboardType="decimal-pad"
          />

          <Text style={styles.sectionTitle}>최근 3일 기록</Text>
          {recentLogs.length === 0 ? (
            <Text style={styles.emptyListText}>최근 3일간 기록이 없어요</Text>
          ) : (
            recentLogs.map((log) => (
              <View key={log.id} style={[styles.logItem, editingId === log.id && styles.logItemActive]}>
                <Pressable style={styles.logItemBody} onPress={() => handleSelectLog(log)}>
                  <Text style={styles.logTitle} numberOfLines={1}>{log.title}</Text>
                  <Text style={styles.logMeta}>{log.date} · {log.hours}시간</Text>
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDeleteLog(log)}
                  disabled={deletingId === log.id}
                  hitSlop={8}
                >
                  <TrashIcon color={COLORS.danger} size={16} />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: COLORS.white, padding: SPACING.xl },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  saveButtonWrap: { minWidth: 84 },
  title: { fontSize: FONT.size.xl, fontWeight: FONT.weight.extrabold, color: COLORS.primaryDark },
  close: { fontSize: FONT.size.xl, color: COLORS.primaryLight },
  label: {
    fontSize: FONT.size.sm,
    color: COLORS.accentLavender,
    fontWeight: FONT.weight.bold,
    marginBottom: SPACING.sm,
  },
  textarea: {
    backgroundColor: COLORS.bgLight,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    fontSize: FONT.size.lg,
    color: COLORS.textDark,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: SPACING.lg,
  },
  newEntryLink: { alignSelf: 'flex-end', marginBottom: SPACING.sm },
  newEntryLinkText: { fontSize: FONT.size.sm, color: COLORS.primary, fontWeight: FONT.weight.bold },
  sectionTitle: {
    fontSize: FONT.size.xs,
    color: COLORS.accentLavender,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: FONT.weight.bold,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  emptyListText: { fontSize: FONT.size.sm, color: COLORS.textMuted, marginBottom: SPACING.lg },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgLight,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  logItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.bgLighter,
  },
  logItemBody: { flex: 1 },
  deleteButton: { padding: SPACING.xs },
  logTitle: { fontSize: FONT.size.md, color: COLORS.textDark, fontWeight: FONT.weight.semibold },
  logMeta: { fontSize: FONT.size.xs, color: COLORS.textMuted, marginTop: 2 },
});
