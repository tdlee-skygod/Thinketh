import { diffDays, hhmmToMs, kstMsSinceMidnight, localDateStr, shiftDateStr } from '@/lib/date';

describe('localDateStr (KST 고정, D-002)', () => {
  it('UTC 14:59는 같은 날, 15:00부터 다음 날(KST 자정)', () => {
    expect(localDateStr(new Date('2026-10-14T14:59:59Z'))).toBe('2026-10-14');
    expect(localDateStr(new Date('2026-10-14T15:00:00Z'))).toBe('2026-10-15');
  });

  it('연말·연초 경계', () => {
    expect(localDateStr(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
  });
});

describe('diffDays / shiftDateStr', () => {
  it('날짜 차이와 이동이 서로 역연산', () => {
    expect(diffDays('2026-10-14', '2026-10-20')).toBe(6);
    expect(diffDays('2026-10-20', '2026-10-14')).toBe(-6);
    expect(shiftDateStr('2026-10-14', 6)).toBe('2026-10-20');
    expect(shiftDateStr('2026-10-14', -14)).toBe('2026-09-30');
  });

  it('윤년 2월과 연 경계를 넘는다', () => {
    expect(diffDays('2028-02-28', '2028-03-01')).toBe(2);
    expect(shiftDateStr('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('시각 변환', () => {
  it('hhmmToMs는 자정 기준 ms', () => {
    expect(hhmmToMs('06:00')).toBe(6 * 3600_000);
    expect(hhmmToMs('22:30:15')).toBe(22 * 3600_000 + 30 * 60_000);
  });

  it('kstMsSinceMidnight은 KST 자정 기준 경과 ms', () => {
    expect(kstMsSinceMidnight(new Date('2026-10-14T15:00:00Z'))).toBe(0);
    expect(kstMsSinceMidnight(new Date('2026-10-14T21:00:00Z'))).toBe(6 * 3600_000);
  });
});
