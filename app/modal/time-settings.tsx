import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useTimeStore } from '@/store/useTimeStore';
import { useRateStore } from '@/store/useRateStore';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { localDateStr, shiftDateStr } from '@/lib/date';
import { formatDateToTime, parseTimeToDate } from '@/lib/pickerDate';
import { daySettingsOn, isPastPeriod, sortPeriods } from '@/lib/rates';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';

// "나의 시간" 설정 (F-21, F-24): 시간당 비용 기간 목록 + 하루 가용시간·활동 시간대
export default function TimeSettingsModal() {
  const router = useRouter();
  const periods = useRateStore((s) => s.periods);
  const fetchPeriods = useRateStore((s) => s.fetchPeriods);
  const daySettings = useTimeStore((s) => s.daySettings);
  const dailyMinutes = useTimeStore((s) => s.dailyMinutes);
  const fetchDaySettings = useTimeStore((s) => s.fetchDaySettings);
  const fetchSummary = useTimeStore((s) => s.fetchSummary);
  const saveDaySettings = useTimeStore((s) => s.saveDaySettings);

  const today = localDateStr();
  const tomorrow = shiftDateStr(today, 1);
  const effective = daySettingsOn(daySettings, tomorrow);

  const [availableHoursText, setAvailableHoursText] = useState(String(effective.availableHoursPerDay));
  const [activeStartTime, setActiveStartTime] = useState(effective.activeStartTime);
  const [activeEndTime, setActiveEndTime] = useState(effective.activeEndTime);
  const [timePickerTarget, setTimePickerTarget] = useState<'activeStart' | 'activeEnd' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPeriods();
    fetchDaySettings();
    fetchSummary();
  }, [fetchPeriods, fetchDaySettings, fetchSummary]);

  // 기록·기간이 있으면 변경은 내일부터 적용된다 (D-250)
  const hasHistory = periods.length > 0 || Object.keys(dailyMinutes).length > 0;

  const handleSaveDaySettings = async () => {
    const availableHours = Number(availableHoursText);
    if (!availableHoursText || Number.isNaN(availableHours) || availableHours < 1 || availableHours > 24) {
      Alert.alert('입력 확인', '가용시간을 1~24 사이의 숫자로 입력해주세요.');
      return;
    }
    if (activeEndTime <= activeStartTime) {
      Alert.alert('입력 확인', '활동 종료 시각은 활동 시작 시각보다 늦어야 합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const applied = await saveDaySettings({
        availableHoursPerDay: Math.round(availableHours),
        activeStartTime,
        activeEndTime,
      });
      Alert.alert(
        '저장했어요',
        applied === 'tomorrow' ? `변경한 설정은 내일(${tomorrow})부터 적용돼요. 오늘과 지난 날은 그대로예요.` : '설정을 저장했어요.'
      );
    } catch (e) {
      console.error('[TimeSettingsModal]', e instanceof Error ? e.message : 'error');
      Alert.alert('오류', '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sorted = sortPeriods(periods);

  return (
    <SafeAreaView style={styles.sheet} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Text style={styles.title}>나의 시간</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>시간당 비용 기간</Text>
          {sorted.length === 0 ? (
            <Text style={styles.empty}>비용 기간을 추가해 주세요. 기간마다 시간당 금액을 다르게 정할 수 있어요.</Text>
          ) : (
            <View style={styles.list}>
              {sorted.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.periodRow}
                  onPress={() => router.push({ pathname: '/modal/rate-period', params: { id: p.id } })}
                >
                  <View style={styles.flex1}>
                    <Text style={styles.periodDates}>
                      {p.startDate} ~ {p.endDate}
                    </Text>
                    <Text style={styles.periodRate}>시간당 {p.hourlyRate.toLocaleString()}원</Text>
                    {isPastPeriod(p, today) && <Text style={styles.periodLock}>지난 날 포함 · 종료일만 수정 가능</Text>}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Button title="+ 기간 추가" variant="ghost" onPress={() => router.push('/modal/rate-period')} />

          <Text style={[styles.label, styles.sectionGap]}>하루 가용시간 · 활동 시간대</Text>
          {hasHistory && (
            <Text style={styles.hint}>변경한 설정은 내일부터 적용돼요. 오늘과 지난 날의 계산은 바뀌지 않아요.</Text>
          )}
          <TextField
            label="하루 가용시간 (1~24시간)"
            value={availableHoursText}
            onChangeText={setAvailableHoursText}
            placeholder="예: 8"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>활동 시작 · 종료 시각 (버려진 시간 실시간 계산 기준)</Text>
          <View style={styles.dateRow}>
            <Pressable style={styles.dateBox} onPress={() => setTimePickerTarget('activeStart')}>
              <Text style={styles.dateCaption}>시작</Text>
              <Text style={styles.dateValue}>{activeStartTime}</Text>
            </Pressable>
            <Text style={styles.arrow}>→</Text>
            <Pressable style={styles.dateBox} onPress={() => setTimePickerTarget('activeEnd')}>
              <Text style={styles.dateCaption}>종료</Text>
              <Text style={styles.dateValue}>{activeEndTime}</Text>
            </Pressable>
          </View>

          <Button title="설정 저장" onPress={handleSaveDaySettings} loading={isSubmitting} />
        </ScrollView>
      </KeyboardAvoidingView>

      {timePickerTarget && (
        <DateTimePicker
          value={parseTimeToDate(timePickerTarget === 'activeStart' ? activeStartTime : activeEndTime)}
          mode="time"
          display="default"
          onChange={(event, date) => {
            const target = timePickerTarget;
            setTimePickerTarget(null);
            if (event.type !== 'set' || !date || !target) return;
            const value = formatDateToTime(date);
            if (target === 'activeStart') setActiveStartTime(value);
            else setActiveEndTime(value);
          }}
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
  label: { fontSize: FONT.size.sm, color: COLORS.accentLavender, fontWeight: FONT.weight.bold, marginBottom: SPACING.sm },
  sectionGap: { marginTop: SPACING.xxl },
  hint: { fontSize: FONT.size.md, color: COLORS.textMuted, lineHeight: 18, marginBottom: SPACING.md },
  empty: { fontSize: FONT.size.md, color: COLORS.textMuted, lineHeight: 18, marginBottom: SPACING.md },
  list: { gap: SPACING.sm, marginBottom: SPACING.md },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgLight,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  periodDates: { fontSize: FONT.size.lg, color: COLORS.textDark, fontWeight: FONT.weight.bold },
  periodRate: { fontSize: FONT.size.md, color: COLORS.primary, marginTop: SPACING.xs },
  periodLock: { fontSize: FONT.size.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
  chevron: { fontSize: FONT.size.xl, color: COLORS.textMuted },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  dateBox: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  dateCaption: { fontSize: FONT.size.xs, color: COLORS.textMuted, fontWeight: FONT.weight.bold, marginBottom: SPACING.xs },
  dateValue: { fontSize: FONT.size.lg, color: COLORS.primary, fontWeight: FONT.weight.extrabold },
  arrow: { color: COLORS.accentLavender, fontSize: FONT.size.lg },
});
