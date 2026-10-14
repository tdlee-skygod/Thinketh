import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useTimeStore } from '@/store/useTimeStore';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { localDateStr } from '@/lib/date';
import { DEFAULT_AVAILABLE_HOURS_PER_DAY, DEFAULT_ACTIVE_START_TIME, DEFAULT_ACTIVE_END_TIME } from '@/constants/time';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';

// 네이티브 날짜 피커가 돌려주는 Date는 사용자가 화면에서 직접 고른 달력 날짜이므로,
// (localDateStr처럼 "지금"을 KST로 변환하는 것과 달리) 기기 로컬 getter로 그대로 읽는다 —
// settings.tsx의 시간 피커(parseTimeToDate/formatDateToTime)와 동일한 패턴.
function parsePickedDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatPickedDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// settings.tsx의 알림 시간대 피커와 동일한 패턴('HH:MM' ↔ Date)
function parseTimeToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatDateToTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TimeSettingsModal() {
  const router = useRouter();
  const settings = useTimeStore((s) => s.settings);
  const saveTimeSettings = useTimeStore((s) => s.saveTimeSettings);

  const today = localDateStr();
  const [startDate, setStartDate] = useState(settings?.startDate ?? today);
  const [endDate, setEndDate] = useState(settings?.endDate ?? today);
  const [hourlyRateText, setHourlyRateText] = useState(settings ? String(settings.hourlyRate) : '');
  const [availableHoursText, setAvailableHoursText] = useState(
    String(settings?.availableHoursPerDay ?? DEFAULT_AVAILABLE_HOURS_PER_DAY)
  );
  const [activeStartTime, setActiveStartTime] = useState(settings?.activeStartTime ?? DEFAULT_ACTIVE_START_TIME);
  const [activeEndTime, setActiveEndTime] = useState(settings?.activeEndTime ?? DEFAULT_ACTIVE_END_TIME);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const [timePickerTarget, setTimePickerTarget] = useState<'activeStart' | 'activeEnd' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    const target = pickerTarget;
    setPickerTarget(null);
    if (event.type !== 'set' || !date || !target) return;
    const value = formatPickedDate(date);
    if (target === 'start') setStartDate(value);
    else setEndDate(value);
  };

  const handleSubmit = async () => {
    const hourlyRate = Number(hourlyRateText);
    const availableHours = Number(availableHoursText);
    if (!hourlyRateText || Number.isNaN(hourlyRate) || hourlyRate < 0) {
      Alert.alert('입력 확인', '시간당 금액을 0 이상의 숫자로 입력해주세요.');
      return;
    }
    if (!availableHoursText || Number.isNaN(availableHours) || availableHours < 1 || availableHours > 24) {
      Alert.alert('입력 확인', '가용시간을 1~24 사이의 숫자로 입력해주세요.');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('입력 확인', '완료일자는 시작일자보다 늦어야 합니다.');
      return;
    }
    if (activeEndTime <= activeStartTime) {
      Alert.alert('입력 확인', '활동 종료 시각은 활동 시작 시각보다 늦어야 합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveTimeSettings(
        startDate,
        endDate,
        Math.round(hourlyRate),
        Math.round(availableHours),
        activeStartTime,
        activeEndTime
      );
      router.back();
    } catch (e) {
      console.error('[TimeSettingsModal]', e);
      Alert.alert('오류', '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.sheet} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Text style={styles.title}>나의 시간</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>시작일자 · 완료일자</Text>
        <View style={styles.dateRow}>
          <Pressable style={styles.dateBox} onPress={() => setPickerTarget('start')}>
            <Text style={styles.dateCaption}>시작</Text>
            <Text style={styles.dateValue}>{startDate}</Text>
          </Pressable>
          <Text style={styles.arrow}>→</Text>
          <Pressable style={styles.dateBox} onPress={() => setPickerTarget('end')}>
            <Text style={styles.dateCaption}>완료</Text>
            <Text style={styles.dateValue}>{endDate}</Text>
          </Pressable>
        </View>

        <TextField
          label="시간당 금액 (원)"
          value={hourlyRateText}
          onChangeText={setHourlyRateText}
          placeholder="예: 5000"
          keyboardType="number-pad"
        />

        <TextField
          label="하루 가용시간 (1~24시간)"
          value={availableHoursText}
          onChangeText={setAvailableHoursText}
          placeholder="예: 8"
          keyboardType="number-pad"
        />

        <Text style={styles.label}>활동 시작 · 종료 시각 (오늘 버려진 시간 실시간 계산 기준)</Text>
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

        <Button title="저장하기" onPress={handleSubmit} loading={isSubmitting} />
      </KeyboardAvoidingView>

      {pickerTarget && (
        <DateTimePicker
          value={parsePickedDate(pickerTarget === 'start' ? startDate : endDate)}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  dateBox: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  dateCaption: { fontSize: FONT.size.xs, color: COLORS.textMuted, fontWeight: FONT.weight.bold, marginBottom: 4 },
  dateValue: { fontSize: FONT.size.lg, color: COLORS.primary, fontWeight: FONT.weight.extrabold },
  arrow: { color: COLORS.accentLavender, fontSize: FONT.size.lg },
});
