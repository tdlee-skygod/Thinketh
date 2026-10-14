import { diffDays, shiftDateStr } from '@/lib/date';
import type { DaySettings, EditCheck, RateIssue, RatePeriod } from '@/types';

// 기간별 시간당 비용 계산·검증 (F-24, D-239, D-250). 모두 부수효과 없는 순수 함수이며 날짜는 KST 'YYYY-MM-DD' 문자열이다.

export const DEFAULT_DAY_SETTINGS: DaySettings = {
  effectiveFrom: '0001-01-01',
  availableHoursPerDay: 8,
  activeStartTime: '06:00',
  activeEndTime: '22:00',
};

export function sortPeriods(periods: RatePeriod[]): RatePeriod[] {
  return [...periods].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

// 그날이 속한 기간의 시간당 금액. 어느 기간에도 속하지 않으면 0
export function rateOn(periods: RatePeriod[], date: string): number {
  const p = periods.find((x) => x.startDate <= date && date <= x.endDate);
  return p ? p.hourlyRate : 0;
}

// 분 × 단가 ÷ 60 — 날짜 하나의 금액이며 마지막에 한 번만 반올림한다 (D-239)
export function moneyOf(periods: RatePeriod[], date: string, minutes: number): number {
  return Math.round((minutes * rateOn(periods, date)) / 60);
}

// 전체 기간: 시작 = 첫 기간 시작일, 끝 = 마지막 기간 종료일. 기간이 없으면 null
export function overallRange(periods: RatePeriod[]): { start: string; end: string } | null {
  if (periods.length === 0) return null;
  const sorted = sortPeriods(periods);
  const end = sorted.reduce((max, p) => (p.endDate > max ? p.endDate : max), sorted[0].endDate);
  return { start: sorted[0].startDate, end };
}

// 날짜 D에 적용되는 설정: effectiveFrom ≤ D 중 가장 늦은 행. 해당 행이 없으면 기본값
export function daySettingsOn(list: DaySettings[], date: string): DaySettings {
  let found: DaySettings | null = null;
  for (const ds of list) {
    if (ds.effectiveFrom <= date && (!found || ds.effectiveFrom > found.effectiveFrom)) found = ds;
  }
  return found ?? DEFAULT_DAY_SETTINGS;
}

// ── 검증 ─────────────────────────────────────────────────────────────

// 시작일 ≤ 종료일, 겹침 없음, 기간 사이 빈 날 없음. 위반마다 안내 문구를 만든다
export function validatePeriods(draft: RatePeriod[]): RateIssue[] {
  const issues: RateIssue[] = [];
  const sorted = sortPeriods(draft);

  for (const p of sorted) {
    if (p.endDate < p.startDate) {
      issues.push({ kind: 'inverted', message: `종료일(${p.endDate})이 시작일(${p.startDate})보다 빨라요.` });
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (next.startDate <= prev.endDate) {
      issues.push({
        kind: 'overlap',
        message: `${prev.startDate}~${prev.endDate} 기간과 ${next.startDate}~${next.endDate} 기간이 겹쳐요.`,
      });
    } else if (next.startDate > shiftDateStr(prev.endDate, 1)) {
      const from = shiftDateStr(prev.endDate, 1);
      const to = shiftDateStr(next.startDate, -1);
      const range = from === to ? from : `${from} ~ ${to}`;
      issues.push({
        kind: 'gap',
        message: `${range}이(가) 비어 있어요. 앞 기간의 종료일을 ${to}로 늘리거나 다음 기간의 시작일을 ${from}로 바꿔 주세요.`,
      });
    }
  }
  return issues;
}

// ── 수정 가능 여부 (D-250) ─────────────────────────────────────────────

// before → after 변경이 허용되는지 판정한다. 기준일 today(KST)보다 이전 날짜가 "지난 날"이다.
// - 시작일이 today보다 이전인 기간: 단가·시작일 변경·삭제 불가, 종료일은 today 이상으로만 변경 (이미 끝난 기간은 종료일도 고정)
// - 시작일이 today 이후인 기간: 수정·삭제 자유, 단 시작일을 today보다 앞으로 당길 수 없다
// - 새로 추가하는 기간도 시작일이 today 이후여야 한다. 단, 기간이 하나도 없던 첫 설정은 제한 없음(과거 기록이 없다)
export function checkPeriodEdit(before: RatePeriod[], after: RatePeriod[], today: string): EditCheck {
  const locked: EditCheck = { editable: false, reason: 'past_period' };
  if (before.length === 0) return { editable: true, reason: null };

  const afterById = new Map(after.map((p) => [p.id, p]));
  const beforeIds = new Set(before.map((p) => p.id));

  for (const b of before) {
    const a = afterById.get(b.id);
    if (b.startDate < today) {
      if (!a) return locked;
      if (a.startDate !== b.startDate || a.hourlyRate !== b.hourlyRate) return locked;
      if (b.endDate < today) {
        if (a.endDate !== b.endDate) return locked;
      } else if (a.endDate < today) {
        return locked;
      }
    } else if (a && a.startDate < today) {
      return locked;
    }
  }

  for (const a of after) {
    if (!beforeIds.has(a.id) && a.startDate < today) return locked;
  }
  return { editable: true, reason: null };
}

// 기록·회고처럼 날짜가 붙은 항목: 오늘 날짜만 추가·수정·삭제할 수 있다. 자정이 지나면 즉시 수정 불가(확정 여부와 무관, D-250)
export function checkDateEdit(date: string, today: string): EditCheck {
  return date >= today ? { editable: true, reason: null } : { editable: false, reason: 'past_date' };
}

// 지난 날짜를 포함한 기간인가 (시작일이 today보다 이전)
export function isPastPeriod(p: RatePeriod, today: string): boolean {
  return p.startDate < today;
}

// ── 편집 보조 ────────────────────────────────────────────────────────

// 기간의 종료일을 바꾼 뒤 다음 기간의 시작일을 종료일 + 1일로 맞춘다. 다음 기간이 통째로 삼켜지면 삭제 목록에 담는다
export function autoAdjustAfterEdit(
  periods: RatePeriod[],
  editedId: string
): { periods: RatePeriod[]; removed: RatePeriod[] } {
  const sorted = sortPeriods(periods).map((p) => ({ ...p }));
  const idx = sorted.findIndex((p) => p.id === editedId);
  if (idx < 0) return { periods: sorted, removed: [] };

  const edited = sorted[idx];
  const removed: RatePeriod[] = [];
  const newNextStart = shiftDateStr(edited.endDate, 1);

  while (idx + 1 < sorted.length && sorted[idx + 1].endDate < newNextStart) {
    removed.push(sorted[idx + 1]);
    sorted.splice(idx + 1, 1);
  }
  if (idx + 1 < sorted.length) sorted[idx + 1].startDate = newNextStart;
  return { periods: sorted, removed };
}

// 기간 삭제: 이웃 기간을 늘려 빈 날이 생기지 않게 한다.
// - fill='prev'(기본): 앞 기간의 종료일을 늘린다. 앞 기간이 없으면(첫 기간) 다음 기간의 시작일을 당긴다
// - fill='next': 다음 기간의 시작일을 당긴다(앞 기간이 지난 날로 잠겨 있을 때 사용)
// 마지막 기간은 그냥 제거한다(전체 기간이 짧아질 뿐 빈 날은 생기지 않는다)
export function removePeriod(periods: RatePeriod[], id: string, fill: 'prev' | 'next' = 'prev'): RatePeriod[] {
  const sorted = sortPeriods(periods).map((p) => ({ ...p }));
  const idx = sorted.findIndex((p) => p.id === id);
  if (idx < 0) return sorted;

  const target = sorted[idx];
  sorted.splice(idx, 1);
  const hasNext = idx < sorted.length;
  if (!hasNext) return sorted;
  if (idx === 0 || fill === 'next') sorted[idx].startDate = target.startDate;
  else sorted[idx - 1].endDate = target.endDate;
  return sorted;
}

// 지난 날짜를 포함한 기간의 단가를 바꾸는 유일한 방법: 현재 기간의 종료일을 오늘로 끊고 내일부터 새 단가 기간을 만든다.
// 기간이 오늘 이후까지 이어지지 않으면 null
export function splitFromTomorrow(
  periods: RatePeriod[],
  id: string,
  newRate: number,
  today: string,
  newId: string
): RatePeriod[] | null {
  const p = periods.find((x) => x.id === id);
  if (!p || p.startDate > today || p.endDate <= today) return null;

  const tomorrow = shiftDateStr(today, 1);
  return sortPeriods([
    ...periods.map((x) => (x.id === id ? { ...x, endDate: today } : x)),
    { id: newId, startDate: tomorrow, endDate: p.endDate, hourlyRate: newRate },
  ]);
}

// ── 합산 (지난·남은 금액) ────────────────────────────────────────────

export interface PastTotals {
  days: number;
  myMinutes: number;
  wastedMinutes: number;
  myAmount: number;
  wastedAmount: number;
}

// 첫 기간 시작일 ~ 어제의 날짜별 합계. 날짜마다 그날의 단가·가용시간을 쓰고, 버려진 시간은 날짜별로 0 미만이 되지 않게 한다
export function computePastTotals(
  periods: RatePeriod[],
  daySettings: DaySettings[],
  dailyMinutes: Record<string, number>,
  today: string
): PastTotals {
  const totals: PastTotals = { days: 0, myMinutes: 0, wastedMinutes: 0, myAmount: 0, wastedAmount: 0 };
  const range = overallRange(periods);
  if (!range) return totals;

  const days = Math.max(0, diffDays(range.start, today));
  for (let i = 0; i < days; i++) {
    const date = shiftDateStr(range.start, i);
    const my = dailyMinutes[date] ?? 0;
    const available = daySettingsOn(daySettings, date).availableHoursPerDay * 60;
    const wasted = Math.max(0, available - my);
    const rate = rateOn(periods, date);
    totals.myMinutes += my;
    totals.wastedMinutes += wasted;
    totals.myAmount += Math.round((my * rate) / 60);
    totals.wastedAmount += Math.round((wasted * rate) / 60);
  }
  totals.days = days;
  return totals;
}

// 남은 금액: 내일 ~ 마지막 기간 종료일의 날짜별 (가용시간 × 단가) 합. 미래 날짜는 현재 설정으로 예상한다
export function computeRemaining(
  periods: RatePeriod[],
  daySettings: DaySettings[],
  today: string
): { days: number; amount: number } {
  const range = overallRange(periods);
  if (!range) return { days: 0, amount: 0 };

  const days = Math.max(0, diffDays(today, range.end));
  let amount = 0;
  for (let i = 1; i <= days; i++) {
    const date = shiftDateStr(today, i);
    amount += daySettingsOn(daySettings, date).availableHoursPerDay * rateOn(periods, date);
  }
  return { days, amount };
}
