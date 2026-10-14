import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTimeStore } from '@/store/useTimeStore';
import { hasDeviceLock, isBiometricAvailable, useLockStore } from '@/store/useLockStore';
import { AppHeader } from '@/components/ui/AppHeader';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';

const LOCK_TIMEOUT_OPTIONS = [
  { sec: 30, label: '30초' },
  { sec: 60, label: '1분' },
  { sec: 300, label: '5분' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const timeSettings = useTimeStore((s) => s.settings);
  const fetchTimeSettings = useTimeStore((s) => s.fetchTimeSettings);
  const biometricEnabled = useLockStore((s) => s.biometricEnabled);
  const lockTimeoutSec = useLockStore((s) => s.lockTimeoutSec);
  const setBiometricEnabled = useLockStore((s) => s.setBiometricEnabled);
  const setLockTimeoutSec = useLockStore((s) => s.setLockTimeoutSec);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [deviceLockAvailable, setDeviceLockAvailable] = useState(true);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
    hasDeviceLock().then(setDeviceLockAvailable);
  }, []);

  const handleBiometricToggle = async (next: boolean) => {
    const ok = await setBiometricEnabled(next);
    if (!ok) Alert.alert('생체인증', '인증에 실패해서 설정을 바꾸지 못했어요.');
  };

  useEffect(() => {
    fetchTimeSettings();
  }, [fetchTimeSettings]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AppHeader />

      <Text style={styles.groupTitle}>앱 잠금</Text>
      <View style={styles.card}>
        <Pressable style={styles.linkRow} onPress={() => router.push('/modal/pin-change')}>
          <Text style={styles.label}>PIN 변경</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        {biometricAvailable && (
          <View style={[styles.linkRow, styles.rowGap]}>
            <Text style={styles.label}>생체인증으로 잠금 해제</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ true: COLORS.primary, false: COLORS.border }}
              thumbColor={COLORS.white}
            />
          </View>
        )}
        <View style={styles.rowGap}>
          <Text style={styles.label}>자동 잠금 시간</Text>
          <Text style={styles.sub}>앱을 벗어난 뒤 이 시간이 지나면 다시 잠겨요</Text>
          <View style={styles.chips}>
            {LOCK_TIMEOUT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.sec}
                style={[styles.chip, lockTimeoutSec === opt.sec && styles.chipActive]}
                onPress={() => setLockTimeoutSec(opt.sec)}
              >
                <Text style={[styles.chipText, lockTimeoutSec === opt.sec && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {!deviceLockAvailable && (
          <Text style={styles.warn}>
            이 기기에는 화면 잠금(PIN·패턴·지문)이 설정되어 있지 않아요. PIN을 잊으면 재설정할 수 없으니 기기 잠금을 먼저 설정해 주세요.
          </Text>
        )}
      </View>

      <Text style={styles.groupTitle}>Time</Text>
      <View style={styles.card}>
        <Pressable style={styles.linkRow} onPress={() => router.push('/modal/time-settings')}>
          <View style={styles.flex1}>
            <Text style={styles.label}>나의 시간</Text>
            <Text style={styles.sub}>
              {timeSettings
                ? `${timeSettings.startDate} ~ ${timeSettings.endDate} · 시간당 ${timeSettings.hourlyRate.toLocaleString()}원`
                : '시작일자, 완료일자, 시간당 금액을 등록해주세요'}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgLighter },
  content: { paddingBottom: SPACING.xxl },
  groupTitle: {
    fontSize: FONT.size.xs,
    color: COLORS.accentLavender,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: FONT.weight.bold,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  card: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  label: { fontSize: FONT.size.md, color: COLORS.textDark, fontWeight: FONT.weight.semibold },
  sub: { fontSize: FONT.size.xs, color: COLORS.textMuted, marginTop: 2 },
  flex1: { flex: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: { fontSize: FONT.size.xl, color: COLORS.textMuted },
  rowGap: { marginTop: SPACING.lg },
  chips: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  chip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONT.size.md, color: COLORS.textDark, fontWeight: FONT.weight.semibold },
  chipTextActive: { color: COLORS.white },
  warn: { fontSize: FONT.size.xs, color: COLORS.waste, marginTop: SPACING.lg, lineHeight: 16 },
});
