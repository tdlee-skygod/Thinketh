import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTimeStore } from '@/store/useTimeStore';
import { useRateStore } from '@/store/useRateStore';
import { AppHeader } from '@/components/ui/AppHeader';
import { EditIcon } from '@/components/ui/icons';
import { localDateStr, diffDays, kstMsSinceMidnight, hhmmToMs } from '@/lib/date';
import { computeLiveWastedHours } from '@/lib/timeTicker';
import { computePastTotals, computeRemaining, daySettingsOn, moneyOf, overallRange, rateOn } from '@/lib/rates';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';

// 금액이 커서 카드 영역을 벗어나면 백만/억 단위로 줄여 표기한다.
function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs >= 100_000_000) {
    const unit = Math.round((abs / 100_000_000) * 10) / 10;
    return `${sign}${unit.toLocaleString('en-US', { maximumFractionDigits: 1 })}억`;
  }
  if (abs >= 1_000_000) {
    const unit = Math.round((abs / 1_000_000) * 10) / 10;
    return `${sign}${unit.toLocaleString('en-US', { maximumFractionDigits: 1 })}백만`;
  }
  return `${sign}${Math.round(abs).toLocaleString('en-US')}`;
}

function formatDays(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function formatHours(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

interface StatRowProps {
  label: string;
  value: string;
  unit: string;
  valueColor: string;
  fontSize: number;
  labelColor?: string;
  valueOpacity?: number;
  dotColor?: string;
  first?: boolean;
  dividerColor: string;
  rightOfLabel?: ReactNode;
}

function StatRow({
  label,
  value,
  unit,
  valueColor,
  fontSize,
  labelColor,
  valueOpacity,
  dotColor,
  first,
  dividerColor,
  rightOfLabel,
}: StatRowProps) {
  return (
    <View style={[styles.statRow, !first && { borderTopWidth: 1, borderTopColor: dividerColor }]}>
      <View style={styles.statLabelWrap}>
        {dotColor && <View style={[styles.dotMini, { backgroundColor: dotColor }]} />}
        <Text style={[styles.statLabel, labelColor && { color: labelColor }]}>{label}</Text>
        {rightOfLabel}
      </View>
      <Text
        style={[styles.statValue, { color: valueColor, fontSize, opacity: valueOpacity ?? 1 }]}
        numberOfLines={1}
      >
        {value}
        <Text style={[styles.statUnit, { color: valueColor, opacity: valueOpacity ?? 1 }]}> {unit}</Text>
      </Text>
    </View>
  );
}

function SectionHead({ label, hint, dotColor, titleColor }: { label: string; hint: string; dotColor: string; titleColor: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.sectionTitle, { color: titleColor }]}>{label}</Text>
      <Text style={styles.sectionHint}>{hint}</Text>
    </View>
  );
}

export default function TimeScreen() {
  const router = useRouter();
  const periods = useRateStore((s) => s.periods);
  const fetchPeriods = useRateStore((s) => s.fetchPeriods);
  const daySettings = useTimeStore((s) => s.daySettings);
  const dailyMinutes = useTimeStore((s) => s.dailyMinutes);
  const fetchDaySettings = useTimeStore((s) => s.fetchDaySettings);
  const fetchSummary = useTimeStore((s) => s.fetchSummary);

  const [nowMs, setNowMs] = useState(() => kstMsSinceMidnight());
  const [today, setToday] = useState(() => localDateStr());

  useEffect(() => {
    fetchPeriods();
    fetchDaySettings();
    fetchSummary();
  }, [fetchPeriods, fetchDaySettings, fetchSummary, today]);

  // 날짜별 단가·가용시간을 쓰는 합산은 입력이 바뀔 때만 다시 계산한다(1초 틱마다 재계산하지 않는다)
  const range = useMemo(() => overallRange(periods), [periods]);
  const pastTotals = useMemo(
    () => computePastTotals(periods, daySettings, dailyMinutes, today),
    [periods, daySettings, dailyMinutes, today]
  );
  const remaining = useMemo(() => computeRemaining(periods, daySettings, today), [periods, daySettings, today]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(kstMsSinceMidnight());
      setToday((prev) => {
        const next = localDateStr();
        return prev === next ? prev : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      <AppHeader />

      {!range ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>설정에서 나의 시간을 등록해주세요</Text>
          <Pressable style={styles.emptyButton} onPress={() => router.push('/(tabs)/settings')}>
            <Text style={styles.emptyButtonText}>설정으로 이동</Text>
          </Pressable>
        </View>
      ) : (
        (() => {
          const ds = daySettingsOn(daySettings, today);
          const availableHours = ds.availableHoursPerDay;
          const todayMinutes = dailyMinutes[today] ?? 0;
          const todayHours = todayMinutes / 60;
          const todayRate = rateOn(periods, today);
          const remainingDays = remaining.days;
          const pastDays = pastTotals.days;

          const { wastedHours: todayWastedHours } = computeLiveWastedHours({
            nowMs,
            activeStartMs: hhmmToMs(ds.activeStartTime),
            activeEndMs: hhmmToMs(ds.activeEndTime),
            availableHours,
            todayHours,
          });
          const pastOnlyHours = pastTotals.myMinutes / 60;
          const pastWastedHours = pastTotals.wastedMinutes / 60;

          const remainingMoney = remaining.amount;
          const todayWastedMoney = todayWastedHours * todayRate;
          const todayMyMoney = moneyOf(periods, today, todayMinutes);
          const pastWastedMoney = pastTotals.wastedAmount;
          const pastMyMoney = pastTotals.myAmount;
          const expired = today > range.end;

          const totalSpan = pastDays + remainingDays;
          const progressPct = totalSpan > 0 ? Math.min(100, Math.max(0, (pastDays / totalSpan) * 100)) : 0;

          return (
            <View style={styles.blocksWrap}>
              {expired && (
                <Pressable style={styles.expiredBanner} onPress={() => router.push('/modal/time-settings')}>
                  <Text style={styles.expiredText}>마지막 비용 기간이 끝났어요. 새 기간을 추가해주세요 ›</Text>
                </Pressable>
              )}
              {/* 남은 — 진행 현황 */}
              <View style={[styles.block, styles.blockRemain]}>
                <SectionHead
                  label="남은 · 진행 현황"
                  hint="완료일까지"
                  dotColor={COLORS.primary}
                  titleColor={COLORS.primary}
                />

                <View style={styles.progressCaption}>
                  <Text style={styles.progressCaptionText}>지난 {formatDays(pastDays)}일</Text>
                  <Text style={styles.progressCaptionText}>남은 {formatDays(remainingDays)}일</Text>
                </View>
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryLight]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${progressPct}%` }]}
                  />
                </View>

                <StatRow
                  label="남은 일수"
                  value={formatDays(remainingDays)}
                  unit="일"
                  valueColor={COLORS.primaryDark}
                  fontSize={34}
                  dividerColor={COLORS.border}
                  first
                />
                <StatRow
                  label="남은 금액"
                  value={formatMoney(remainingMoney)}
                  unit="원"
                  valueColor={COLORS.primaryDark}
                  fontSize={34}
                  dividerColor={COLORS.border}
                />
              </View>

              {/* 오늘 */}
              <View style={[styles.block, styles.blockToday]}>
                <SectionHead
                  label="오늘"
                  hint={`가용 ${availableHours}시간 · ${ds.activeStartTime}~${ds.activeEndTime}`}
                  dotColor={COLORS.accentLavender}
                  titleColor={COLORS.textMuted}
                />

                <StatRow
                  label="버려진 시간"
                  value={formatHours(todayWastedHours)}
                  unit="시간"
                  valueColor={COLORS.waste}
                  labelColor={COLORS.waste}
                  dotColor={COLORS.waste}
                  fontSize={32}
                  dividerColor={COLORS.borderLight}
                  first
                />
                <StatRow
                  label="버려진 금액"
                  value={formatMoney(todayWastedMoney)}
                  unit="원"
                  valueColor={COLORS.waste}
                  labelColor={COLORS.waste}
                  dotColor={COLORS.waste}
                  fontSize={32}
                  dividerColor={COLORS.borderLight}
                />
                <StatRow
                  label="나의 시간"
                  value={formatHours(todayHours)}
                  unit="시간"
                  valueColor={COLORS.mine}
                  labelColor={COLORS.mine}
                  dotColor={COLORS.mine}
                  fontSize={32}
                  dividerColor={COLORS.borderLight}
                  rightOfLabel={
                    <Pressable
                      style={styles.editButton}
                      onPress={() => router.push('/modal/time-log')}
                      hitSlop={8}
                    >
                      <EditIcon color={COLORS.mine} size={12} />
                    </Pressable>
                  }
                />
                <StatRow
                  label="나의 금액"
                  value={formatMoney(todayMyMoney)}
                  unit="원"
                  valueColor={COLORS.mine}
                  labelColor={COLORS.mine}
                  dotColor={COLORS.mine}
                  fontSize={32}
                  dividerColor={COLORS.borderLight}
                />
              </View>

              {/* 지난 기록 */}
              <View style={[styles.block, styles.blockPast]}>
                <SectionHead
                  label="지난 기록"
                  hint="시작일부터 누적"
                  dotColor={COLORS.accentLavender}
                  titleColor={COLORS.textMuted}
                />

                <StatRow
                  label="지난 일수"
                  value={formatDays(pastDays)}
                  unit="일"
                  valueColor={COLORS.textDark}
                  fontSize={22}
                  dividerColor={COLORS.borderLight}
                  first
                />
                <StatRow
                  label="지난 버려진 금액"
                  value={formatMoney(pastWastedMoney)}
                  unit="원"
                  valueColor={COLORS.waste}
                  valueOpacity={0.82}
                  dotColor={COLORS.waste}
                  fontSize={22}
                  dividerColor={COLORS.borderLight}
                />
                <StatRow
                  label="지난 나의 금액"
                  value={formatMoney(pastMyMoney)}
                  unit="원"
                  valueColor={COLORS.mine}
                  valueOpacity={0.82}
                  dotColor={COLORS.mine}
                  fontSize={22}
                  dividerColor={COLORS.borderLight}
                />

                {pastDays <= 0 && (
                  <Text style={styles.pastNote}>
                    ※ 오늘 시작한 프로젝트라 지난 일수가 0일이라 음수가 나올 수 있어요.
                  </Text>
                )}
              </View>
            </View>
          );
        })()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgLighter },

  expiredBanner: {
    backgroundColor: COLORS.wasteWash,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  expiredText: { color: COLORS.waste, fontSize: FONT.size.md, fontWeight: FONT.weight.semibold },

  blocksWrap: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },

  block: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  blockRemain: { backgroundColor: COLORS.bgLight },
  blockToday: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  blockPast: { backgroundColor: COLORS.pastWash },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  sectionTitle: { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, letterSpacing: 0.5 },
  sectionHint: { marginLeft: 'auto', fontSize: FONT.size.xs, color: COLORS.textMuted },

  progressCaption: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  progressCaptionText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, color: COLORS.textMuted },
  progressTrack: {
    height: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', borderRadius: RADIUS.pill },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  statLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexShrink: 0 },
  dotMini: { width: 6, height: 6, borderRadius: 3 },
  statLabel: {
    fontSize: FONT.size.sm,
    color: COLORS.textMuted,
    fontFamily: FONT.familyFND.regular,
  },
  statValue: {
    flex: 1,
    fontFamily: FONT.familyFND.bold,
    textAlign: 'right',
  },
  statUnit: {
    fontSize: FONT.size.sm,
    fontFamily: FONT.familyFND.regular,
  },
  editButton: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.mineWash,
    borderWidth: 1.3,
    borderColor: '#b7e4cf',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pastNote: {
    fontSize: FONT.size.xs,
    color: COLORS.textMuted,
    paddingBottom: SPACING.xs,
    lineHeight: 15,
  },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl, gap: SPACING.lg },
  emptyText: {
    fontSize: FONT.size.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontFamily: FONT.familyFND.regular,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontWeight: FONT.weight.bold,
    fontFamily: FONT.familyFND.regular,
  },
});
