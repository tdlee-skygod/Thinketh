import * as SQLite from 'expo-sqlite';
import type { SQLiteBindParams } from 'expo-sqlite';
import { File } from 'expo-file-system';
import { createDbKey, readDbKey } from '@/lib/secure';
import type { DbOpenResult } from '@/types';

// 암호화된 로컬 DB (D-234, D-236). SQL은 이 모듈과 store에서만 실행하고, 값은 항상 파라미터 바인딩(?)으로 넘긴다 (D-244).
// DB를 열 수 없어도 파일을 지우지 않는다 — 복구 흐름은 D-253.

const DB_NAME = 'thinketh.db';
const KEY_PATTERN = /^[0-9a-f]{64}$/;

// 마이그레이션은 순서대로 한 번씩만 적용한다. 앱이 아는 최대 버전보다 높은 DB는 열지 않는다.
const MIGRATIONS: { version: number; statements: string[] }[] = [
  {
    version: 1,
    statements: [
      // 날짜별 적용 설정 (D-250). 최초 행은 effective_from='0001-01-01'
      `create table day_settings (
        effective_from text primary key,
        available_hours_per_day integer not null default 8 check (available_hours_per_day between 1 and 24),
        active_start_time text not null default '06:00',
        active_end_time text not null default '22:00'
      )`,
      `insert into day_settings (effective_from) values ('0001-01-01')`,
      // 시간당 비용 기간 (F-24, D-239). 단계 1에서 다중 기간·검증이 붙는다
      `create table rate_periods (
        id text primary key,
        start_date text not null,
        end_date text not null check (end_date >= start_date),
        hourly_rate integer not null check (hourly_rate >= 0)
      )`,
      `create index idx_rate_periods_start on rate_periods(start_date)`,
      // 시간 기록 (F-21). 단위는 분(정수, D-239)
      `create table time_logs (
        id text primary key,
        date text not null,
        title text not null,
        content text not null default '',
        minutes integer not null check (minutes > 0),
        created_at text not null,
        updated_at text not null
      )`,
      `create index idx_time_logs_date on time_logs(date)`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

let db: SQLite.SQLiteDatabase | null = null;
let txQueue: Promise<unknown> = Promise.resolve();

function classifyOpenError(e: unknown): 'key_mismatch' | 'corrupted' | 'transient' {
  const message = e instanceof Error ? e.message : String(e);
  if (/not a database|encrypted/i.test(message)) return 'key_mismatch';
  if (/malformed|corrupt/i.test(message)) return 'corrupted';
  return 'transient';
}

// 앱 시작 때 한 번 호출한다. 실패해도 DB 파일은 건드리지 않는다.
export async function openDb(): Promise<DbOpenResult> {
  if (db) return { ok: true };

  let opened: SQLite.SQLiteDatabase | null = null;
  try {
    // 키가 없으면(첫 실행 또는 키 분실) 새 키를 만든다. 기존 파일이 있었다면 아래 검증에서 key_mismatch가 된다.
    const key = (await readDbKey()) ?? (await createDbKey());
    if (!KEY_PATTERN.test(key)) return { ok: false, reason: 'key_mismatch' };

    opened = await SQLite.openDatabaseAsync(DB_NAME);
    // PRAGMA는 값을 바인딩할 수 없어 키를 직접 넣는다. 위 패턴(64자리 hex)으로 검증된 값만 쓴다.
    await opened.execAsync(`PRAGMA key = "x'${key}'";`);
    await opened.getFirstAsync('select count(*) as n from sqlite_master');
    await opened.execAsync('PRAGMA foreign_keys = ON;');
  } catch (e) {
    await opened?.closeAsync().catch(() => undefined);
    return { ok: false, reason: classifyOpenError(e) };
  }

  try {
    await opened.execAsync(
      'create table if not exists schema_version (version integer primary key, applied_at text not null)'
    );
    const row = await opened.getFirstAsync<{ v: number | null }>('select max(version) as v from schema_version');
    const current = row?.v ?? 0;
    if (current > LATEST_SCHEMA_VERSION) {
      await opened.closeAsync();
      return { ok: false, reason: 'newer_version' };
    }

    for (const m of MIGRATIONS.filter((x) => x.version > current)) {
      await opened.withTransactionAsync(async () => {
        for (const sql of m.statements) await opened!.execAsync(sql);
        await opened!.runAsync('insert into schema_version (version, applied_at) values (?, ?)', [
          m.version,
          new Date().toISOString(),
        ]);
      });
    }
  } catch (e) {
    await opened.closeAsync().catch(() => undefined);
    return { ok: false, reason: classifyOpenError(e) };
  }

  db = opened;
  return { ok: true };
}

function requireDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('DB가 열려 있지 않습니다');
  return db;
}

export async function dbRun(sql: string, params: SQLiteBindParams = []): Promise<void> {
  await requireDb().runAsync(sql, params);
}

export async function dbGet<T>(sql: string, params: SQLiteBindParams = []): Promise<T | null> {
  return requireDb().getFirstAsync<T>(sql, params);
}

export async function dbAll<T>(sql: string, params: SQLiteBindParams = []): Promise<T[]> {
  return requireDb().getAllAsync<T>(sql, params);
}

// 여러 쓰기를 하나로 묶는다. 연결이 하나라 트랜잭션끼리는 순서대로 실행한다.
export function dbTransaction(task: () => Promise<void>): Promise<void> {
  const run = txQueue.then(() => requireDb().withTransactionAsync(task));
  txQueue = run.catch(() => undefined);
  return run;
}

// 열 수 없는 DB 파일을 지우지 않고 이름만 바꿔 보존한다 (D-253). DB가 닫혀 있을 때(열기 실패 직후)만 호출한다.
// 암호화 키(SecureStore)는 그대로 두므로, 새로 만든 DB도 같은 키를 쓰고 보존한 파일은 원래 키가 맞다면 나중에 열 수 있다.
export async function archiveDbFiles(): Promise<void> {
  if (db) throw new Error('DB가 열려 있을 때는 보존할 수 없습니다');
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  for (const suffix of ['', '-wal', '-shm']) {
    const file = new File(`file://${SQLite.defaultDatabaseDirectory}/${DB_NAME}${suffix}`);
    if (file.exists) file.rename(`${DB_NAME}${suffix}.bak-${stamp}`);
  }
}
