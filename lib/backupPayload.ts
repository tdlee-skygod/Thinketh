import { BackupError } from '@/lib/backupCrypto';
import { checkPeriodEdit, validatePeriods } from '@/lib/rates';
import type { BackupPayload, DaySettings, RatePeriod, TimeLog } from '@/types';

// 백업 내용 검증과 병합 계획 (D-237, D-253). 부수효과 없는 순수 함수라 jest로 검증한다.

const MAX_DAY_SETTINGS = 5_000;
const MAX_RATE_PERIODS = 1_000;
const MAX_TIME_LOGS = 200_000;
const MAX_ID_LEN = 100;
const MAX_TITLE_LEN = 1_000;
const MAX_CONTENT_LEN = 20_000;
const MAX_MINUTES = 1_000_000;
const MAX_RATE = 1_000_000_000;

const INITIAL_EFFECTIVE_FROM = '0001-01-01';

function invalid(message: string): never {
  throw new BackupError('invalid_payload', `백업 내용이 올바르지 않아요. (${message})`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isDateStr(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last;
}

function isTimeStr(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function isIso(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
}

function str(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string' || v.length > max) invalid(field);
  return v;
}

function int(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) invalid(field);
  return v;
}

function list(v: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) invalid(field);
  return v;
}

function uniqueBy<T>(items: T[], key: (t: T) => string, field: string): void {
  const seen = new Set<string>();
  for (const it of items) {
    const k = key(it);
    if (seen.has(k)) invalid(`${field} 중복`);
    seen.add(k);
  }
}

// 복호화된 JSON을 엄격하게 검증하고, 알려진 필드만 골라 새 객체로 돌려준다. maxSchemaVersion보다 새로운 백업은 거부한다
export function validatePayload(raw: unknown, maxSchemaVersion: number): BackupPayload {
  if (!isRecord(raw)) invalid('구조');
  if (raw.formatVersion !== 1) {
    throw new BackupError('unsupported_version', '지원하지 않는 백업 형식이에요. 앱을 업데이트해 주세요.');
  }
  const schemaVersion = int(raw.schemaVersion, 'schemaVersion', 1, 10_000);
  if (schemaVersion > maxSchemaVersion) {
    throw new BackupError('unsupported_version', '더 새로운 버전의 앱에서 만든 백업이에요. 앱을 업데이트해 주세요.');
  }
  if (!isIso(raw.exportedAt)) invalid('exportedAt');

  const daySettings: DaySettings[] = list(raw.daySettings, 'daySettings', MAX_DAY_SETTINGS).map((r) => {
    if (!isRecord(r)) invalid('daySettings 항목');
    if (!isDateStr(r.effectiveFrom)) invalid('effectiveFrom');
    if (!isTimeStr(r.activeStartTime) || !isTimeStr(r.activeEndTime) || r.activeEndTime <= r.activeStartTime) {
      invalid('활동 시간대');
    }
    return {
      effectiveFrom: r.effectiveFrom,
      availableHoursPerDay: int(r.availableHoursPerDay, 'availableHoursPerDay', 1, 24),
      activeStartTime: r.activeStartTime,
      activeEndTime: r.activeEndTime,
    };
  });
  uniqueBy(daySettings, (d) => d.effectiveFrom, 'daySettings');
  // 최초 행이 있어야 첫 설정·날짜별 조회가 앱 동작과 같게 유지된다
  if (!daySettings.some((d) => d.effectiveFrom === INITIAL_EFFECTIVE_FROM)) invalid('daySettings 최초 행');

  const ratePeriods: RatePeriod[] = list(raw.ratePeriods, 'ratePeriods', MAX_RATE_PERIODS).map((r) => {
    if (!isRecord(r)) invalid('ratePeriods 항목');
    if (!isDateStr(r.startDate) || !isDateStr(r.endDate)) invalid('기간 날짜');
    return {
      id: str(r.id, 'id', MAX_ID_LEN),
      startDate: r.startDate,
      endDate: r.endDate,
      hourlyRate: int(r.hourlyRate, 'hourlyRate', 0, MAX_RATE),
    };
  });
  uniqueBy(ratePeriods, (p) => p.id, 'ratePeriods id');
  if (validatePeriods(ratePeriods).length > 0) invalid('비용 기간이 겹치거나 비어 있음');

  const timeLogs: TimeLog[] = list(raw.timeLogs, 'timeLogs', MAX_TIME_LOGS).map((r) => {
    if (!isRecord(r)) invalid('timeLogs 항목');
    if (!isDateStr(r.date) || !isIso(r.createdAt) || !isIso(r.updatedAt)) invalid('기록 날짜');
    return {
      id: str(r.id, 'id', MAX_ID_LEN),
      date: r.date,
      title: str(r.title, 'title', MAX_TITLE_LEN),
      content: str(r.content, 'content', MAX_CONTENT_LEN),
      minutes: int(r.minutes, 'minutes', 1, MAX_MINUTES),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
  uniqueBy(timeLogs, (l) => l.id, 'timeLogs id');

  return { formatVersion: 1, schemaVersion, exportedAt: raw.exportedAt, daySettings, ratePeriods, timeLogs };
}

// ── 병합 (D-253) ─────────────────────────────────────────────────────

export interface LocalSnapshot {
  daySettings: DaySettings[];
  ratePeriods: RatePeriod[];
  timeLogs: TimeLog[];
}

export type MergePlan =
  | {
      ok: true;
      daySettings: DaySettings[];      // 통째 교체
      ratePeriods: RatePeriod[];       // 통째 교체
      logsToUpsert: TimeLog[];         // 오늘 이후 날짜의 새 기록·더 최근에 수정된 기록
      summary: { added: number; updated: number; skippedPast: number };
    }
  | { ok: false; message: string };

const SAME_DAY_SETTINGS = (a: DaySettings, b: DaySettings) =>
  a.availableHoursPerDay === b.availableHoursPerDay &&
  a.activeStartTime === b.activeStartTime &&
  a.activeEndTime === b.activeEndTime;

// 병합 규칙:
// - 비용 기간·날짜별 설정은 백업 것으로 통째 교체하되, 이 폰의 지난 기간·지난 설정을 바꾸게 되면 거부한다(D-250). 전체 복원은 덮어쓰기를 쓴다
// - 기록은 오늘 이후 날짜만 id 기준으로 합치고 updated_at이 최신인 쪽을 채택한다. 지난 날짜의 기록은 추가하지도 바꾸지도 않는다
export function planMerge(local: LocalSnapshot, incoming: BackupPayload, today: string): MergePlan {
  const rejectMessage = '이 폰의 지난 기록과 맞지 않아 병합할 수 없어요. 지난 날짜까지 모두 복원하려면 덮어쓰기를 선택해 주세요.';

  if (!checkPeriodEdit(local.ratePeriods, incoming.ratePeriods, today).editable) {
    return { ok: false, message: rejectMessage };
  }

  const localById = new Map(local.daySettings.map((d) => [d.effectiveFrom, d]));
  const incomingById = new Map(incoming.daySettings.map((d) => [d.effectiveFrom, d]));
  for (const l of local.daySettings) {
    if (l.effectiveFrom > today) continue;
    const i = incomingById.get(l.effectiveFrom);
    if (!i || !SAME_DAY_SETTINGS(l, i)) return { ok: false, message: rejectMessage };
  }
  for (const i of incoming.daySettings) {
    if (i.effectiveFrom <= today && !localById.has(i.effectiveFrom)) return { ok: false, message: rejectMessage };
  }

  const localLogs = new Map(local.timeLogs.map((l) => [l.id, l]));
  const logsToUpsert: TimeLog[] = [];
  const summary = { added: 0, updated: 0, skippedPast: 0 };
  for (const log of incoming.timeLogs) {
    if (log.date < today) {
      summary.skippedPast++;
      continue;
    }
    const existing = localLogs.get(log.id);
    if (!existing) {
      logsToUpsert.push(log);
      summary.added++;
    } else if (existing.date >= today && log.updatedAt > existing.updatedAt) {
      logsToUpsert.push(log);
      summary.updated++;
    }
  }

  return { ok: true, daySettings: incoming.daySettings, ratePeriods: incoming.ratePeriods, logsToUpsert, summary };
}
