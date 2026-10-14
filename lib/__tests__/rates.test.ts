import {
  autoAdjustAfterEdit,
  checkDateEdit,
  checkPeriodEdit,
  computePastTotals,
  computeRemaining,
  daySettingsOn,
  moneyOf,
  overallRange,
  rateOn,
  removePeriod,
  splitFromTomorrow,
  validatePeriods,
} from '@/lib/rates';
import type { DaySettings, RatePeriod } from '@/types';

const P1: RatePeriod = { id: 'a', startDate: '2026-10-01', endDate: '2026-12-30', hourlyRate: 50000 };
const P2: RatePeriod = { id: 'b', startDate: '2026-12-31', endDate: '2027-03-31', hourlyRate: 100000 };

describe('단가 조회·금액 (D-239)', () => {
  it('날짜가 속한 기간의 단가, 기간 밖은 0', () => {
    expect(rateOn([P1, P2], '2026-10-01')).toBe(50000);
    expect(rateOn([P1, P2], '2026-12-30')).toBe(50000);
    expect(rateOn([P1, P2], '2026-12-31')).toBe(100000);
    expect(rateOn([P1, P2], '2026-09-30')).toBe(0);
    expect(rateOn([P1, P2], '2027-04-01')).toBe(0);
  });

  it('분 × 단가 ÷ 60을 마지막에 한 번만 반올림', () => {
    expect(moneyOf([P1], '2026-10-05', 90)).toBe(75000);
    expect(moneyOf([P1], '2026-10-05', 1)).toBe(833); // 833.33…
    expect(moneyOf([P1], '2026-09-01', 120)).toBe(0);
  });

  it('전체 기간은 첫 시작일 ~ 마지막 종료일', () => {
    expect(overallRange([P2, P1])).toEqual({ start: '2026-10-01', end: '2027-03-31' });
    expect(overallRange([])).toBeNull();
  });
});

describe('validatePeriods', () => {
  it('붙어 있는 기간은 통과', () => {
    expect(validatePeriods([P1, P2])).toEqual([]);
  });

  it('빈 날이 있으면 빈 구간 날짜를 안내', () => {
    const issues = validatePeriods([P1, { ...P2, startDate: '2027-01-03' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe('gap');
    expect(issues[0].message).toContain('2026-12-31 ~ 2027-01-02');
  });

  it('하루만 비어도 검출', () => {
    const issues = validatePeriods([P1, { ...P2, startDate: '2027-01-01' }]);
    expect(issues[0].kind).toBe('gap');
    expect(issues[0].message).toContain('2026-12-31이(가) 비어 있어요');
  });

  it('겹치거나 종료일이 시작일보다 빠르면 검출', () => {
    expect(validatePeriods([P1, { ...P2, startDate: '2026-12-30' }])[0].kind).toBe('overlap');
    expect(validatePeriods([{ ...P1, endDate: '2026-09-01' }])[0].kind).toBe('inverted');
  });
});

describe('autoAdjustAfterEdit / removePeriod', () => {
  it('종료일을 바꾸면 다음 기간의 시작일이 맞춰진다', () => {
    const edited = [{ ...P1, endDate: '2026-12-20' }, P2];
    const { periods, removed } = autoAdjustAfterEdit(edited, 'a');
    expect(removed).toEqual([]);
    expect(periods[1].startDate).toBe('2026-12-21');
    expect(validatePeriods(periods)).toEqual([]);
  });

  it('다음 기간을 통째로 삼키면 삭제 목록으로 돌려준다', () => {
    const edited = [{ ...P1, endDate: '2027-04-10' }, P2];
    const { periods, removed } = autoAdjustAfterEdit(edited, 'a');
    expect(removed.map((p) => p.id)).toEqual(['b']);
    expect(periods).toHaveLength(1);
  });

  it('중간 기간 삭제는 앞 기간을 늘려 메운다 / next 지정 시 다음 기간을 당긴다', () => {
    const P3: RatePeriod = { id: 'c', startDate: '2027-04-01', endDate: '2027-06-30', hourlyRate: 70000 };
    const prevFilled = removePeriod([P1, P2, P3], 'b');
    expect(prevFilled.map((p) => [p.id, p.startDate, p.endDate])).toEqual([
      ['a', '2026-10-01', '2027-03-31'],
      ['c', '2027-04-01', '2027-06-30'],
    ]);
    const nextFilled = removePeriod([P1, P2, P3], 'b', 'next');
    expect(nextFilled[1].startDate).toBe('2026-12-31');
    expect(validatePeriods(prevFilled)).toEqual([]);
    expect(validatePeriods(nextFilled)).toEqual([]);
  });

  it('첫 기간 삭제는 다음 기간을 당기고, 마지막 기간 삭제는 그냥 제거', () => {
    expect(removePeriod([P1, P2], 'a')[0].startDate).toBe('2026-10-01');
    expect(removePeriod([P1, P2], 'b')).toHaveLength(1);
  });
});

describe('checkPeriodEdit — 지난 날짜 수정 불가 (D-250)', () => {
  const today = '2026-11-10';

  it('기간이 하나도 없던 첫 설정은 제한 없음', () => {
    expect(checkPeriodEdit([], [P1], today).editable).toBe(true);
  });

  it('지난 날짜를 포함한 기간의 단가·시작일 변경·삭제는 거부', () => {
    expect(checkPeriodEdit([P1, P2], [{ ...P1, hourlyRate: 60000 }, P2], today)).toEqual({
      editable: false,
      reason: 'past_period',
    });
    expect(checkPeriodEdit([P1, P2], [{ ...P1, startDate: '2026-09-01' }, P2], today).editable).toBe(false);
    expect(checkPeriodEdit([P1, P2], [P2], today).editable).toBe(false);
  });

  it('지난 날짜를 포함한 기간의 종료일은 오늘 이후로만 변경', () => {
    expect(checkPeriodEdit([P1, P2], [{ ...P1, endDate: '2026-12-20' }, P2], today).editable).toBe(true);
    expect(checkPeriodEdit([P1, P2], [{ ...P1, endDate: '2026-11-09' }, P2], today).editable).toBe(false);
    expect(checkPeriodEdit([P1, P2], [{ ...P1, endDate: today }, P2], today).editable).toBe(true);
  });

  it('이미 끝난 기간은 종료일도 고정', () => {
    const ended: RatePeriod = { id: 'z', startDate: '2026-10-01', endDate: '2026-10-31', hourlyRate: 10000 };
    expect(checkPeriodEdit([ended, { ...P2, id: 'y', startDate: '2026-11-01' }], [{ ...ended, endDate: '2026-11-20' }], today).editable).toBe(false);
  });

  it('미래 기간은 자유롭게 수정·삭제하되 시작일을 과거로 당길 수 없다', () => {
    const future: RatePeriod = { id: 'f', startDate: '2026-12-31', endDate: '2027-03-31', hourlyRate: 100000 };
    expect(checkPeriodEdit([P1, future], [P1, { ...future, hourlyRate: 1 }], today).editable).toBe(true);
    expect(checkPeriodEdit([P1, future], [P1], today).editable).toBe(true);
    expect(checkPeriodEdit([P1, future], [P1, { ...future, startDate: '2026-11-01' }], today).editable).toBe(false);
  });

  it('새 기간은 시작일이 오늘 이후여야 한다', () => {
    expect(checkPeriodEdit([P1], [P1, { id: 'n', startDate: '2026-10-05', endDate: '2026-10-06', hourlyRate: 1 }], today).editable).toBe(false);
    expect(checkPeriodEdit([P1], [P1, { id: 'n', startDate: '2026-12-31', endDate: '2027-01-31', hourlyRate: 1 }], today).editable).toBe(true);
  });
});

describe('splitFromTomorrow', () => {
  it('현재 기간을 오늘로 끊고 내일부터 새 단가 기간을 만든다', () => {
    const result = splitFromTomorrow([P1, P2], 'a', 60000, '2026-11-10', 'new');
    expect(result).not.toBeNull();
    const [first, second, third] = result!;
    expect(first).toMatchObject({ id: 'a', endDate: '2026-11-10', hourlyRate: 50000 });
    expect(second).toMatchObject({ id: 'new', startDate: '2026-11-11', endDate: '2026-12-30', hourlyRate: 60000 });
    expect(third.id).toBe('b');
    expect(validatePeriods(result!)).toEqual([]);
    expect(checkPeriodEdit([P1, P2], result!, '2026-11-10').editable).toBe(true);
  });

  it('오늘 이후까지 이어지지 않는 기간은 분할 불가', () => {
    expect(splitFromTomorrow([P1], 'a', 1, '2026-12-30', 'n')).toBeNull();
    expect(splitFromTomorrow([P1], 'a', 1, '2026-09-01', 'n')).toBeNull();
  });
});

describe('날짜별 설정·합산', () => {
  const ds: DaySettings[] = [
    { effectiveFrom: '0001-01-01', availableHoursPerDay: 8, activeStartTime: '06:00', activeEndTime: '22:00' },
    { effectiveFrom: '2026-10-10', availableHoursPerDay: 10, activeStartTime: '06:00', activeEndTime: '22:00' },
  ];

  it('날짜에 적용되는 가장 늦은 행을 고른다', () => {
    expect(daySettingsOn(ds, '2026-10-09').availableHoursPerDay).toBe(8);
    expect(daySettingsOn(ds, '2026-10-10').availableHoursPerDay).toBe(10);
    expect(daySettingsOn([], '2026-10-10').availableHoursPerDay).toBe(8);
  });

  it('기간이 하나일 때 지난 합계는 단일 단가 계산과 같다', () => {
    const period: RatePeriod = { id: 'x', startDate: '2026-10-01', endDate: '2026-10-31', hourlyRate: 6000 };
    const single: DaySettings[] = [ds[0]];
    const minutes: Record<string, number> = { '2026-10-01': 120, '2026-10-03': 600 };
    const totals = computePastTotals([period], single, minutes, '2026-10-05'); // 10/01~10/04, 4일
    expect(totals.days).toBe(4);
    expect(totals.myMinutes).toBe(720);
    // 가용 480분: 10/01 360 + 10/02 480 + 10/03 0(초과분 0) + 10/04 480 = 1320분
    expect(totals.wastedMinutes).toBe(1320);
    expect(totals.myAmount).toBe(Math.round((120 * 6000) / 60) + Math.round((600 * 6000) / 60));
    expect(totals.wastedAmount).toBe(Math.round((1320 * 6000) / 60));
  });

  it('날짜별로 다른 단가·가용시간을 적용한다', () => {
    const periods = [P1, P2];
    const totals = computePastTotals(periods, ds, {}, '2026-10-12'); // 10/01~10/11
    // 10/01~10/09 가용 8h, 10/10~10/11 가용 10h, 단가 5만
    expect(totals.wastedAmount).toBe(9 * 8 * 50000 + 2 * 10 * 50000);
  });

  it('오늘이 시작일 이전이거나 기간이 없으면 지난 일수는 0', () => {
    expect(computePastTotals([P1], ds, {}, '2026-09-01').days).toBe(0);
    expect(computePastTotals([], ds, {}, '2026-10-12').days).toBe(0);
  });

  it('남은 금액은 내일부터 종료일까지 날짜별 단가의 합', () => {
    const r = computeRemaining([P1, P2], [ds[0]], '2026-12-29');
    // 12/30(5만) + 12/31~2027-03-31(10만 × 91일) → 일수 = diff(12/29, 3/31)
    expect(r.days).toBe(92);
    expect(r.amount).toBe(8 * 50000 + 91 * 8 * 100000);
  });

  it('종료일이 지나면 남은 일수·금액은 0', () => {
    expect(computeRemaining([P1], [ds[0]], '2027-01-01')).toEqual({ days: 0, amount: 0 });
  });
});

describe('checkDateEdit (D-250)', () => {
  it('오늘 기록만 수정 가능, 어제부터는 불가', () => {
    expect(checkDateEdit('2026-11-10', '2026-11-10')).toEqual({ editable: true, reason: null });
    expect(checkDateEdit('2026-11-09', '2026-11-10')).toEqual({ editable: false, reason: 'past_date' });
  });
});
