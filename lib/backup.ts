import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { dbAll, dbRun, dbTransaction, LATEST_SCHEMA_VERSION } from '@/lib/localDb';
import { BackupError, decryptBackup, encryptBackup } from '@/lib/backupCrypto';
import { planMerge, validatePayload } from '@/lib/backupPayload';
import type { LocalSnapshot } from '@/lib/backupPayload';
import { localDateStr } from '@/lib/date';
import type { BackupMode, BackupPayload, DaySettings, RatePeriod, TimeLog } from '@/types';

// 내보내기/가져오기 (F-25, D-237, D-253). 비밀번호·평문 페이로드는 로그에 남기지 않는다 (D-244).

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const BACKUP_FORMAT_VERSION = 1;

interface DaySettingsRow {
  effective_from: string;
  available_hours_per_day: number;
  active_start_time: string;
  active_end_time: string;
}
interface RatePeriodRow {
  id: string;
  start_date: string;
  end_date: string;
  hourly_rate: number;
}
interface TimeLogRow {
  id: string;
  date: string;
  title: string;
  content: string;
  minutes: number;
  created_at: string;
  updated_at: string;
}

async function readSnapshot(): Promise<LocalSnapshot> {
  const [ds, rp, tl] = await Promise.all([
    dbAll<DaySettingsRow>('select * from day_settings order by effective_from'),
    dbAll<RatePeriodRow>('select * from rate_periods order by start_date'),
    dbAll<TimeLogRow>('select * from time_logs order by date, created_at'),
  ]);
  const daySettings: DaySettings[] = ds.map((r) => ({
    effectiveFrom: r.effective_from,
    availableHoursPerDay: r.available_hours_per_day,
    activeStartTime: r.active_start_time,
    activeEndTime: r.active_end_time,
  }));
  const ratePeriods: RatePeriod[] = rp.map((r) => ({
    id: r.id,
    startDate: r.start_date,
    endDate: r.end_date,
    hourlyRate: r.hourly_rate,
  }));
  const timeLogs: TimeLog[] = tl.map((r) => ({
    id: r.id,
    date: r.date,
    title: r.title,
    content: r.content,
    minutes: r.minutes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return { daySettings, ratePeriods, timeLogs };
}

// ── 내보내기 ─────────────────────────────────────────────────────────

// 암호화한 백업 파일을 앱 캐시에 만들고 경로를 돌려준다. 비밀번호 없이는 만들 수 없다(평문 내보내기 없음)
export async function createBackupFile(password: string): Promise<string> {
  const snapshot = await readSnapshot();
  const payload: BackupPayload = {
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: LATEST_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...snapshot,
  };
  const encrypted = await encryptBackup(JSON.stringify(payload), password);

  const file = new File(Paths.cache, `thinketh-backup-${localDateStr()}.thkbak`);
  file.create({ overwrite: true });
  file.write(encrypted);
  return file.uri;
}

// 공유 시트로 내보낸 뒤 캐시의 임시 파일을 지운다
export async function shareBackupFile(uri: string): Promise<void> {
  try {
    if (!(await Sharing.isAvailableAsync())) throw new BackupError('bad_format', '이 기기에서는 파일을 공유할 수 없어요.');
    await Sharing.shareAsync(uri, { mimeType: 'application/octet-stream', dialogTitle: 'Thinketh 백업 파일 저장' });
  } finally {
    try {
      new File(uri).delete();
    } catch {
      // 임시 파일 삭제 실패는 무시한다(캐시는 시스템이 정리한다)
    }
  }
}

// ── 가져오기 ─────────────────────────────────────────────────────────

// 파일 읽기 → 크기·형식 확인 → 복호화 → 내용 검증. DB는 건드리지 않는다
export async function prepareImport(uri: string, password: string): Promise<BackupPayload> {
  const file = new File(uri);
  if (file.size !== null && file.size > MAX_FILE_BYTES) {
    throw new BackupError('too_large', '파일이 너무 커요. 이 앱의 백업 파일이 맞는지 확인해 주세요.');
  }
  const text = await file.text();
  if (text.length > MAX_FILE_BYTES) throw new BackupError('too_large', '파일이 너무 커요.');

  const plain = await decryptBackup(text, password);
  let raw: unknown;
  try {
    raw = JSON.parse(plain);
  } catch {
    throw new BackupError('invalid_payload', '백업 내용이 올바르지 않아요.');
  }
  return validatePayload(raw, LATEST_SCHEMA_VERSION);
}

export interface ImportSummary {
  mode: BackupMode;
  added: number;
  updated: number;
  skippedPast: number;
}

async function insertAll(payload: { daySettings: DaySettings[]; ratePeriods: RatePeriod[] }): Promise<void> {
  for (const d of payload.daySettings) {
    await dbRun(
      'insert into day_settings (effective_from, available_hours_per_day, active_start_time, active_end_time) values (?, ?, ?, ?)',
      [d.effectiveFrom, d.availableHoursPerDay, d.activeStartTime, d.activeEndTime]
    );
  }
  for (const p of payload.ratePeriods) {
    await dbRun('insert into rate_periods (id, start_date, end_date, hourly_rate) values (?, ?, ?, ?)', [
      p.id,
      p.startDate,
      p.endDate,
      p.hourlyRate,
    ]);
  }
}

async function upsertLog(l: TimeLog): Promise<void> {
  await dbRun(
    `insert into time_logs (id, date, title, content, minutes, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)
     on conflict(id) do update set date = excluded.date, title = excluded.title, content = excluded.content,
       minutes = excluded.minutes, created_at = excluded.created_at, updated_at = excluded.updated_at`,
    [l.id, l.date, l.title, l.content, l.minutes, l.createdAt, l.updatedAt]
  );
}

// 검증된 페이로드를 하나의 트랜잭션으로 반영한다. 실패하면 롤백되어 기존 데이터가 유지된다
export async function applyImport(payload: BackupPayload, mode: BackupMode): Promise<ImportSummary> {
  if (mode === 'overwrite') {
    await dbTransaction(async () => {
      await dbRun('delete from time_logs');
      await dbRun('delete from rate_periods');
      await dbRun('delete from day_settings');
      await insertAll(payload);
      for (const l of payload.timeLogs) await upsertLog(l);
    });
    return { mode, added: payload.timeLogs.length, updated: 0, skippedPast: 0 };
  }

  const plan = planMerge(await readSnapshot(), payload, localDateStr());
  if (!plan.ok) throw new BackupError('invalid_payload', plan.message);

  await dbTransaction(async () => {
    await dbRun('delete from rate_periods');
    await dbRun('delete from day_settings');
    await insertAll(plan);
    for (const l of plan.logsToUpsert) await upsertLog(l);
  });
  return { mode, ...plan.summary };
}
