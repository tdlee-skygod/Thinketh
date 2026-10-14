import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useRateStore } from '@/store/useRateStore';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { localDateStr, shiftDateStr } from '@/lib/date';
import { formatPickedDate, parsePickedDate } from '@/lib/pickerDate';
import { autoAdjustAfterEdit, isPastPeriod, removePeriod, sortPeriods, splitFromTomorrow } from '@/lib/rates';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';
import type { RatePeriod } from '@/types';

// 시간당 비용 기간 추가·수정 (F-24, D-239, D-250)
export default function RatePeriodModal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const periods = useRateStore((s) => s.periods);
  const savePeriods = useRateStore((s) => s.savePeriods);
  const checkEdit = useRateStore((s) => s.checkEdit);

  const today = localDateStr();
  const existing = id ? periods.find((p) => p.id === id) : undefined;
  const sorted = sortPeriods(periods);
  const lastEnd = sorted.length > 0 ? sorted[sorted.length - 1].endDate : null;
  const defaultStart = lastEnd ? shiftDateStr(lastEnd, 1) : today;

  const [startDate, setStartDate] = useState(existing?.startDate ?? defaultStart);
  const [endDate, setEndDate] = useState(existing?.endDate ?? defaultStart);
  const [rateText, setRateText] = useState(existing ? String(existing.hourlyRate) : '');
  const [newRateText, setNewRateText] = useState('');
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 지난 날짜를 포함한 기간은 시작일·단가를 바꿀 수 없다 (D-250)
  const locked = existing ? isPastPeriod(existing, today) : false;
  const canSplit = locked && existing !== undefined && existing.endDate > today;

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    const target = pickerTarget;
    setPickerTarget(null);
    if (event.type !== 'set' || !date || !target) return;
    const value = formatPickedDate(date);
    if (target === 'start') setStartDate(value);
    else setEndDate(value);
  };

  const parseRate = (text: string): number | null => {
    const n = Number(text);
    return text !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };

  const persist = async (draft: RatePeriod[]) => {
    setIsSubmitting(true);
    try {
      const result = await savePeriods(draft);
      if (!result.ok) {
        Alert.alert('저장할 수 없어요', result.message);
        return;
      }
      router.back();
    } catch (e) {
      console.error('[RatePeriodModal]', e instanceof Error ? e.message : 'error');
      Alert.alert('오류', '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    const hourlyRate = parseRate(rateText);
    if (hourlyRate === null) {
      Alert.alert('입력 확인', '시간당 금액을 0 이상의 숫자로 입력해주세요.');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('입력 확인', '종료일은 시작일보다 빠를 수 없어요.');
      return;
    }

    const editedId = existing ? existing.id : randomUUID();
    const edited: RatePeriod = { id: editedId, startDate, endDate, hourlyRate };
    const draft = existing ? periods.map((p) => (p.id === editedId ? edited : p)) : [...periods, edited];
    const { periods: adjusted, removed } = autoAdjustAfterEdit(draft, editedId);

    if (removed.length > 0) {
      const names = removed.map((p) => `${p.startDate}~${p.endDate}`).join('\n');
      Alert.alert('다음 기간이 삭제돼요', `종료일을 늘리면 아래 기간이 통째로 포함되어 삭제돼요.\n\n${names}`, [
        { text: '취소', style: 'cancel' },
        { text: '계속', style: 'destructive', onPress: () => persist(adjusted) },
      ]);
      return;
    }
    await persist(adjusted);
  };

  const handleSplit = async () => {
    const newRate = parseRate(newRateText);
    if (newRate === null || !existing) {
      Alert.alert('입력 확인', '새 시간당 금액을 0 이상의 숫자로 입력해주세요.');
      return;
    }
    const result = splitFromTomorrow(periods, existing.id, newRate, today, randomUUID());
    if (!result) {
      Alert.alert('적용할 수 없어요', '이 기간은 내일 이후까지 이어지지 않아요. 새 기간을 추가해 주세요.');
      return;
    }
    Alert.alert(
      '내일부터 새 단가 적용',
      `${existing.startDate} ~ ${today}은 기존 단가를 유지하고, ${shiftDateStr(today, 1)}부터 ${existing.endDate}까지 ${newRate.toLocaleString()}원으로 적용해요.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '적용', onPress: () => persist(result) },
      ]
    );
  };

  const handleDelete = () => {
    if (!existing) return;
    let after = removePeriod(periods, existing.id);
    if (!checkEdit(periods, after).editable) after = removePeriod(periods, existing.id, 'next');
    if (!checkEdit(periods, after).editable) {
      Alert.alert('삭제할 수 없어요', '지난 날짜가 포함된 기간은 삭제할 수 없어요.');
      return;
    }
    Alert.alert('기간 삭제', '이 기간을 삭제할까요? 빈 날이 생기지 않도록 이웃 기간이 늘어나요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => persist(after) },
    ]);
  };

  return (
    <SafeAreaView style={styles.sheet} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Text style={styles.title}>{existing ? '비용 기간 수정' : '비용 기간 추가'}</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          {locked && (
            <Text style={styles.lockNote}>
              지난 날짜가 포함된 기간이라 시작일과 시간당 금액은 바꿀 수 없어요. 종료일만 오늘 이후로 바꿀 수 있어요.
            </Text>
          )}

          <Text style={styles.label}>시작일 · 종료일</Text>
          <View style={styles.dateRow}>
            <Pressable
              style={[styles.dateBox, locked && styles.dateBoxLocked]}
              onPress={() => setPickerTarget('start')}
              disabled={locked}
            >
              <Text style={styles.dateCaption}>시작</Text>
              <Text style={styles.dateValue}>{startDate}</Text>
            </Pressable>
            <Text style={styles.arrow}>→</Text>
            <Pressable style={styles.dateBox} onPress={() => setPickerTarget('end')}>
              <Text style={styles.dateCaption}>종료</Text>
              <Text style={styles.dateValue}>{endDate}</Text>
            </Pressable>
          </View>

          <TextField
            label="시간당 금액 (원)"
            value={rateText}
            onChangeText={setRateText}
            placeholder="예: 50000"
            keyboardType="number-pad"
            editable={!locked}
          />

          <Button title="저장하기" onPress={handleSave} loading={isSubmitting} />

          {canSplit && (
            <View style={styles.splitBox}>
              <Text style={styles.label}>단가를 바꾸고 싶다면</Text>
              <Text style={styles.hint}>
                오늘까지는 기존 단가를 유지하고, 내일부터 새 단가를 적용해요. 지난 금액은 다시 계산되지 않아요.
              </Text>
              <TextField
                label="새 시간당 금액 (원)"
                value={newRateText}
                onChangeText={setNewRateText}
                placeholder="예: 100000"
                keyboardType="number-pad"
              />
              <Button title="내일부터 새 단가 적용" variant="ghost" onPress={handleSplit} disabled={isSubmitting} />
            </View>
          )}

          {existing && !locked && (
            <View style={styles.deleteBox}>
              <Button title="이 기간 삭제" variant="danger" onPress={handleDelete} disabled={isSubmitting} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {pickerTarget && (
        <DateTimePicker
          value={parsePickedDate(pickerTarget === 'start' ? startDate : endDate)}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: COLORS.white, padding: SPACING.xl },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  title: { fontSize: FONT.size.xl, fontWeight: FONT.weight.extrabold, color: COLORS.primaryDark },
  close: { fontSize: FONT.size.xl, color: COLORS.primaryLight },
  lockNote: {
    backgroundColor: COLORS.pastWash,
    color: COLORS.textDark,
    fontSize: FONT.size.md,
    lineHeight: 18,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  label: { fontSize: FONT.size.sm, color: COLORS.accentLavender, fontWeight: FONT.weight.bold, marginBottom: SPACING.sm },
  hint: { fontSize: FONT.size.md, color: COLORS.textMuted, lineHeight: 18, marginBottom: SPACING.md },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  dateBox: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  dateBoxLocked: { opacity: 0.5 },
  dateCaption: { fontSize: FONT.size.xs, color: COLORS.textMuted, fontWeight: FONT.weight.bold, marginBottom: SPACING.xs },
  dateValue: { fontSize: FONT.size.lg, color: COLORS.primary, fontWeight: FONT.weight.extrabold },
  arrow: { color: COLORS.accentLavender, fontSize: FONT.size.lg },
  splitBox: { marginTop: SPACING.xxl, paddingTop: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  deleteBox: { marginTop: SPACING.xxl },
});
