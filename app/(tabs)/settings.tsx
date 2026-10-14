import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';
import { useTimeStore } from '@/store/useTimeStore';
import { AppHeader } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/Button';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const timeSettings = useTimeStore((s) => s.settings);
  const fetchTimeSettings = useTimeStore((s) => s.fetchTimeSettings);

  useEffect(() => {
    fetchTimeSettings();
  }, [fetchTimeSettings]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AppHeader />

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.displayName || profile?.email || '?').charAt(0)}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profile?.displayName || profile?.email}</Text>
          <Text style={styles.profileEmail}>{profile?.email}</Text>
        </View>
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

      <View style={styles.logoutRow}>
        <Button title="로그아웃" variant="ghost" onPress={signOut} />
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgLighter },
  content: { paddingBottom: SPACING.xxl },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    margin: SPACING.lg,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.white, fontSize: FONT.size.xl, fontWeight: FONT.weight.extrabold },
  profileInfo: { flex: 1 },
  profileName: { color: COLORS.white, fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
  profileEmail: { color: 'rgba(255,255,255,0.6)', fontSize: FONT.size.xs, marginTop: 2 },
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
  logoutRow: { margin: SPACING.lg },
});
