import { planMerge, validatePayload } from '@/lib/backupPayload';
import type { BackupPayload, DaySettings, RatePeriod, TimeLog } from '@/types';

// backupCrypto(BackupError)가 expo-crypto를 불러오므로 테스트에서는 대체한다
jest.mock('expo-crypto', () => ({ getRandomBytes: () => new Uint8Array(0) }));

const MAX_SCHEMA = 1;
const TODAY = '2026-11-10';

const DS0: DaySettings = { effectiveFrom: '0001-01-01', availableHoursPerDay: 8, activeStartTime: '06:00', activeEndTime: '22:00' };
const P1: RatePeriod = { id: 'a', startDate: '2026-10-01', endDate: '2026-12-30', hourlyRate: 50000 };
const log = (id: string, date: string, updatedAt = '2026-11-01T00:00:00.000Z', minutes = 60): TimeLog => ({
  id,
  date,
  title: '운동',
  content: '',
  minutes,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt,
});

const payload = (over: Partial<BackupPayload> = {}): BackupPayload => ({
  formatVersion: 1,
  schemaVersion: 1,
  exportedAt: '2026-11-10T00:00:00.000Z',
  daySettings: [DS0],
  ratePeriods: [P1],
  timeLogs: [log('l1', '2026-11-05')],
  ...over,
});

describe('validatePayload', () => {
  it('올바른 내용은 통과하고 알려진 필드만 남긴다', () => {
    const result = validatePayload({ ...payload(), extra: 'ignored' }, MAX_SCHEMA);
    expect(result).toEqual(payload());
    expect('extra' in result).toBe(false);
  });

  it('구조·형식 오류는 invalid_payload', () => {
    const bad = (raw: unknown) => expect(() => validatePayload(raw, MAX_SCHEMA)).toThrow(/백업 내용이 올바르지 않아요/);
    bad(null);
    bad([]);
    bad({ ...payload(), exportedAt: 'nope' });
    bad({ ...payload(), daySettings: 'x' });
    bad({ ...payload(), timeLogs: [{ ...log('x', '2026-02-30') }] });          // 존재하지 않는 날짜
    bad({ ...payload(), timeLogs: [{ ...log('x', '2026-11-05'), minutes: 0 }] });
    bad({ ...payload(), timeLogs: [{ ...log('x', '2026-11-05'), minutes: 1.5 }] });
    bad({ ...payload(), ratePeriods: [{ ...P1, hourlyRate: -1 }] });
    bad({ ...payload(), daySettings: [{ ...DS0, availableHoursPerDay: 25 }] });
    bad({ ...payload(), daySettings: [{ ...DS0, activeStartTime: '22:00', activeEndTime: '06:00' }] });
  });

  it('최초 day_settings 행이 없거나 id·날짜가 중복되면 거부', () => {
    const bad = (raw: unknown) => expect(() => validatePayload(raw, MAX_SCHEMA)).toThrow(/백업 내용이 올바르지 않아요/);
    bad({ ...payload(), daySettings: [{ ...DS0, effectiveFrom: '2026-11-11' }] });
    bad({ ...payload(), daySettings: [DS0, DS0] });
    bad({ ...payload(), timeLogs: [log('d', '2026-11-05'), log('d', '2026-11-06')] });
    bad({ ...payload(), ratePeriods: [P1, P1] });
  });

  it('비용 기간이 겹치거나 빈 날이 있으면 거부', () => {
    const gap = { id: 'b', startDate: '2027-01-05', endDate: '2027-02-01', hourlyRate: 1 };
    expect(() => validatePayload(payload({ ratePeriods: [P1, gap] }), MAX_SCHEMA)).toThrow(/겹치거나 비어/);
  });

  it('더 새로운 형식·스키마 버전은 unsupported_version', () => {
    expect(() => validatePayload({ ...payload(), formatVersion: 2 }, MAX_SCHEMA)).toThrow(/업데이트/);
    expect(() => validatePayload(payload({ schemaVersion: 2 }), MAX_SCHEMA)).toThrow(/업데이트/);
  });
});

describe('planMerge (D-250, D-253)', () => {
  const local = { daySettings: [DS0], ratePeriods: [P1], timeLogs: [log('old', '2026-11-05')] };

  it('오늘 이후의 새 기록은 추가, 지난 날짜 기록은 추가하지 않고 건너뛴다', () => {
    const plan = planMerge(
      local,
      payload({ timeLogs: [log('past', '2026-11-01'), log('today', TODAY), log('future', '2026-11-12')] }),
      TODAY
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.logsToUpsert.map((l) => l.id)).toEqual(['today', 'future']);
      expect(plan.summary).toEqual({ added: 2, updated: 0, skippedPast: 1 });
    }
  });

  it('같은 id는 updated_at이 더 최신인 쪽을 채택(오늘 기록)', () => {
    const localToday = { ...local, timeLogs: [log('t', TODAY, '2026-11-10T01:00:00.000Z', 30)] };
    const newer = planMerge(localToday, payload({ timeLogs: [log('t', TODAY, '2026-11-10T02:00:00.000Z', 90)] }), TODAY);
    const older = planMerge(localToday, payload({ timeLogs: [log('t', TODAY, '2026-11-10T00:00:00.000Z', 90)] }), TODAY);
    expect(newer.ok && newer.logsToUpsert[0].minutes).toBe(90);
    expect(older.ok && older.logsToUpsert.length).toBe(0);
  });

  it('로컬의 지난 날짜 기록은 같은 id라도 덮어쓰지 않는다', () => {
    const plan = planMerge(local, payload({ timeLogs: [log('old', '2026-11-05', '2030-01-01T00:00:00.000Z', 999)] }), TODAY);
    expect(plan.ok && plan.logsToUpsert).toEqual([]);
  });

  it('비용 기간·날짜별 설정은 백업 것으로 통째 교체된다(미래 부분)', () => {
    const future: RatePeriod = { id: 'f', startDate: '2026-12-31', endDate: '2027-03-31', hourlyRate: 100000 };
    const futureSettings: DaySettings = { ...DS0, effectiveFrom: '2026-12-01', availableHoursPerDay: 10 };
    const plan = planMerge(local, payload({ ratePeriods: [P1, future], daySettings: [DS0, futureSettings] }), TODAY);
    expect(plan.ok && plan.ratePeriods).toHaveLength(2);
    expect(plan.ok && plan.daySettings).toHaveLength(2);
  });

  it('이 폰의 지난 비용 기간을 바꾸는 백업은 병합 거부', () => {
    const plan = planMerge(local, payload({ ratePeriods: [{ ...P1, hourlyRate: 1 }] }), TODAY);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.message).toContain('덮어쓰기');
  });

  it('지난 날짜의 설정 행이 다르거나 추가되면 병합 거부', () => {
    const changed = planMerge(local, payload({ daySettings: [{ ...DS0, availableHoursPerDay: 9 }] }), TODAY);
    const added = planMerge(local, payload({ daySettings: [DS0, { ...DS0, effectiveFrom: '2026-10-05' }] }), TODAY);
    expect(changed.ok).toBe(false);
    expect(added.ok).toBe(false);
  });

  it('로컬이 비어 있으면(새 폰) 기간은 제한 없이 가져온다', () => {
    const empty = { daySettings: [DS0], ratePeriods: [], timeLogs: [] };
    const plan = planMerge(empty, payload(), TODAY);
    expect(plan.ok).toBe(true);
  });
});
