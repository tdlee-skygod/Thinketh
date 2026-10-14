import { computeLiveWastedHours } from '@/lib/timeTicker';

const HOUR = 3600_000;
const base = { activeStartMs: 6 * HOUR, activeEndMs: 22 * HOUR, availableHours: 8 };

describe('computeLiveWastedHours (D-231)', () => {
  it('활동 시작 전에는 0으로 정지', () => {
    const r = computeLiveWastedHours({ ...base, nowMs: 5 * HOUR, todayHours: 0 });
    expect(r).toEqual({ wastedHours: 0, started: false, finalized: false });
  });

  it('활동 시간대 중간(50%)에는 가용시간의 절반 − 나의 시간', () => {
    const r = computeLiveWastedHours({ ...base, nowMs: 14 * HOUR, todayHours: 1 });
    expect(r.wastedHours).toBeCloseTo(3);
    expect(r.started).toBe(true);
    expect(r.finalized).toBe(false);
  });

  it('활동 종료 후에는 가용시간 − 나의 시간으로 확정된다', () => {
    const r = computeLiveWastedHours({ ...base, nowMs: 23 * HOUR, todayHours: 2.5 });
    expect(r.wastedHours).toBeCloseTo(5.5);
    expect(r.finalized).toBe(true);
  });

  it('나의 시간이 배분값보다 크면 0, 가용시간을 넘지 않는다', () => {
    expect(computeLiveWastedHours({ ...base, nowMs: 8 * HOUR, todayHours: 5 }).wastedHours).toBe(0);
    expect(computeLiveWastedHours({ ...base, nowMs: 23 * HOUR, todayHours: 0 }).wastedHours).toBe(8);
  });

  it('나의 시간을 몇 번에 나눠 기록해도 합계만 같으면 같은 값', () => {
    const once = computeLiveWastedHours({ ...base, nowMs: 18 * HOUR, todayHours: 2 }).wastedHours;
    const split = computeLiveWastedHours({ ...base, nowMs: 18 * HOUR, todayHours: 0.5 + 1.5 }).wastedHours;
    expect(split).toBe(once);
  });

  it('시작 ≥ 종료인 잘못된 시간대는 0', () => {
    const r = computeLiveWastedHours({ nowMs: 10 * HOUR, activeStartMs: 22 * HOUR, activeEndMs: 6 * HOUR, availableHours: 8, todayHours: 0 });
    expect(r.wastedHours).toBe(0);
  });
});
