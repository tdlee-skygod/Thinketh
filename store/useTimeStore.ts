import { create } from 'zustand';
import { randomUUID } from 'expo-crypto';
import { dbAll, dbGet, dbRun } from '@/lib/localDb';
import { localDateStr, shiftDateStr } from '@/lib/date';
import { checkDateEdit, daySettingsOn } from '@/lib/rates';
import type { DaySettings, EditCheck, TimeLog } from '@/types';

const RECENT_LOG_DAYS = 3;
const FIRST_DAY_SETTINGS = '0001-01-01';

interface DaySettingsRow {
  effective_from: string;
  available_hours_per_day: number;
  active_start_time: string;
  active_end_time: string;
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

function mapDaySettings(row: DaySettingsRow): DaySettings {
  return {
    effectiveFrom: row.effective_from,
    availableHoursPerDay: row.available_hours_per_day,
    activeStartTime: row.active_start_time,
    activeEndTime: row.active_end_time,
  };
}

function mapTimeLog(row: TimeLogRow): TimeLog {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    content: row.content,
    minutes: row.minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const EDITABLE: EditCheck = { editable: true, reason: null };

interface TimeState {
  daySettings: DaySettings[];                // effective_from 오름차순 — daySettingsOn(날짜별 적용값)의 입력
  dailyMinutes: Record<string, number>;      // 날짜 → 나의 시간 합계(분)
  recentLogs: TimeLog[];                     // 최근 3일 기록 (date desc, 같은 날짜 안에서는 최신순)
  isLoading: boolean;
  fetchDaySettings: () => Promise<void>;
  // 가용시간·활동 시간대 저장. 기록·기간이 아직 없으면 바로 적용('immediate'), 있으면 내일부터 적용('tomorrow') — D-250
  saveDaySettings: (patch: Partial<Omit<DaySettings, 'effectiveFrom'>>) => Promise<'immediate' | 'tomorrow'>;
  fetchSummary: () => Promise<void>;
  fetchRecentLogs: () => Promise<void>;
  addTimeLog: (title: string, content: string, minutes: number) => Promise<void>;
  // 오늘 기록만 수정·삭제할 수 있다(D-250). 지난 날 기록이면 저장하지 않고 사유를 돌려준다
  updateTimeLog: (id: string, title: string, content: string, minutes: number) => Promise<EditCheck>;
  deleteTimeLog: (id: string) => Promise<EditCheck>;
}

async function checkLogEditable(id: string): Promise<EditCheck | 'missing'> {
  const row = await dbGet<{ date: string }>('select date from time_logs where id = ?', [id]);
  if (!row) return 'missing';
  return checkDateEdit(row.date, localDateStr());
}

export const useTimeStore = create<TimeState>((set, get) => ({
  daySettings: [],
  dailyMinutes: {},
  recentLogs: [],
  isLoading: false,

  fetchDaySettings: async () => {
    try {
      const rows = await dbAll<DaySettingsRow>('select * from day_settings order by effective_from');
      set({ daySettings: rows.map(mapDaySettings) });
    } catch (e) {
      console.error('[useTimeStore] fetchDaySettings', e instanceof Error ? e.message : 'error');
    }
  },

  saveDaySettings: async (patch) => {
    const today = localDateStr();
    const tomorrow = shiftDateStr(today, 1);

    const periodCount = await dbGet<{ n: number }>('select count(*) as n from rate_periods');
    const logCount = await dbGet<{ n: number }>('select count(*) as n from time_logs');
    const hasHistory = (periodCount?.n ?? 0) > 0 || (logCount?.n ?? 0) > 0;

    if (!hasHistory) {
      // 첫 설정: 바꿀 과거가 없으므로 최초 행을 바로 수정한다
      const base = daySettingsOn(get().daySettings, FIRST_DAY_SETTINGS);
      const next = { ...base, ...patch };
      await dbRun(
        'update day_settings set available_hours_per_day = ?, active_start_time = ?, active_end_time = ? where effective_from = ?',
        [next.availableHoursPerDay, next.activeStartTime, next.activeEndTime, FIRST_DAY_SETTINGS]
      );
      await get().fetchDaySettings();
      return 'immediate';
    }

    // 이후 변경: 내일 시작 행을 upsert한다. 오늘 이하의 행은 건드리지 않는다
    const base = daySettingsOn(get().daySettings, tomorrow);
    const next = { ...base, ...patch };
    await dbRun(
      `insert into day_settings (effective_from, available_hours_per_day, active_start_time, active_end_time)
       values (?, ?, ?, ?)
       on conflict(effective_from) do update set
         available_hours_per_day = excluded.available_hours_per_day,
         active_start_time = excluded.active_start_time,
         active_end_time = excluded.active_end_time`,
      [tomorrow, next.availableHoursPerDay, next.activeStartTime, next.activeEndTime]
    );
    await get().fetchDaySettings();
    return 'tomorrow';
  },

  fetchSummary: async () => {
    try {
      const rows = await dbAll<{ date: string; m: number }>('select date, sum(minutes) as m from time_logs group by date');
      const map: Record<string, number> = {};
      for (const r of rows) map[r.date] = r.m;
      set({ dailyMinutes: map });
    } catch (e) {
      console.error('[useTimeStore] fetchSummary', e instanceof Error ? e.message : 'error');
    }
  },

  fetchRecentLogs: async () => {
    try {
      const since = shiftDateStr(localDateStr(), -(RECENT_LOG_DAYS - 1));
      const rows = await dbAll<TimeLogRow>(
        'select * from time_logs where date >= ? order by date desc, created_at desc',
        [since]
      );
      set({ recentLogs: rows.map(mapTimeLog) });
    } catch (e) {
      console.error('[useTimeStore] fetchRecentLogs', e instanceof Error ? e.message : 'error');
    }
  },

  addTimeLog: async (title, content, minutes) => {
    const now = new Date().toISOString();
    await dbRun(
      'insert into time_logs (id, date, title, content, minutes, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), localDateStr(), title, content, minutes, now, now]
    );
    await get().fetchSummary();
    await get().fetchRecentLogs();
  },

  updateTimeLog: async (id, title, content, minutes) => {
    const check = await checkLogEditable(id);
    if (check === 'missing') return EDITABLE;
    if (!check.editable) return check;

    await dbRun('update time_logs set title = ?, content = ?, minutes = ?, updated_at = ? where id = ?', [
      title,
      content,
      minutes,
      new Date().toISOString(),
      id,
    ]);
    await get().fetchSummary();
    await get().fetchRecentLogs();
    return EDITABLE;
  },

  deleteTimeLog: async (id) => {
    const check = await checkLogEditable(id);
    if (check === 'missing') return EDITABLE;
    if (!check.editable) return check;

    await dbRun('delete from time_logs where id = ?', [id]);
    await get().fetchSummary();
    await get().fetchRecentLogs();
    return EDITABLE;
  },
}));
