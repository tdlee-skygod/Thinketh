import { create } from 'zustand';
import { randomUUID } from 'expo-crypto';
import { dbAll, dbGet, dbRun, dbTransaction } from '@/lib/localDb';
import { localDateStr, shiftDateStr } from '@/lib/date';
import type { TimeSettings, TimeLog } from '@/types';

const RECENT_LOG_DAYS = 3;
const FIRST_DAY_SETTINGS = '0001-01-01';

interface RatePeriodRow {
  start_date: string;
  end_date: string;
  hourly_rate: number;
}

interface DaySettingsRow {
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

interface TimeState {
  settings: TimeSettings | null;
  todayMinutes: number;  // 오늘 나의 시간 합계(분)
  pastMinutes: number;   // 시작일~오늘 나의 시간 누적 합계(분, 오늘 포함)
  recentLogs: TimeLog[]; // 최근 3일 기록 (date desc, 같은 날짜 안에서는 최신순)
  isLoading: boolean;
  fetchTimeSettings: () => Promise<TimeSettings | null>;
  saveTimeSettings: (
    startDate: string,
    endDate: string,
    hourlyRate: number,
    availableHoursPerDay: number,
    activeStartTime: string,
    activeEndTime: string
  ) => Promise<void>;
  fetchTimeSummary: () => Promise<void>;
  fetchRecentLogs: () => Promise<void>;
  addTimeLog: (title: string, content: string, minutes: number) => Promise<void>;
  updateTimeLog: (id: string, title: string, content: string, minutes: number) => Promise<void>;
  deleteTimeLog: (id: string) => Promise<void>;
}

export const useTimeStore = create<TimeState>((set, get) => ({
  settings: null,
  todayMinutes: 0,
  pastMinutes: 0,
  recentLogs: [],
  isLoading: false,

  fetchTimeSettings: async () => {
    set({ isLoading: true });
    try {
      const today = localDateStr();
      // 단계 0: 비용 기간은 1개만 쓴다(첫 기간). 다중 기간은 단계 1에서 확장
      const period = await dbGet<RatePeriodRow>(
        'select start_date, end_date, hourly_rate from rate_periods order by start_date limit 1'
      );
      const day = await dbGet<DaySettingsRow>(
        'select available_hours_per_day, active_start_time, active_end_time from day_settings where effective_from <= ? order by effective_from desc limit 1',
        [today]
      );

      const mapped: TimeSettings | null =
        period && day
          ? {
              startDate: period.start_date,
              endDate: period.end_date,
              hourlyRate: period.hourly_rate,
              availableHoursPerDay: day.available_hours_per_day,
              activeStartTime: day.active_start_time,
              activeEndTime: day.active_end_time,
            }
          : null;
      set({ settings: mapped });
      return mapped;
    } catch (e) {
      console.error('[useTimeStore] fetchTimeSettings', e instanceof Error ? e.message : 'error');
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  saveTimeSettings: async (startDate, endDate, hourlyRate, availableHoursPerDay, activeStartTime, activeEndTime) => {
    // 단계 0의 임시 동작: 비용 기간 1개를 통째로 바꾸고 최초 day_settings 행을 덮어쓴다.
    // 과거 날짜 보호·"내일부터 적용"(D-250)은 단계 1에서 구현한다.
    await dbTransaction(async () => {
      await dbRun('delete from rate_periods');
      await dbRun('insert into rate_periods (id, start_date, end_date, hourly_rate) values (?, ?, ?, ?)', [
        randomUUID(),
        startDate,
        endDate,
        hourlyRate,
      ]);
      await dbRun(
        'update day_settings set available_hours_per_day = ?, active_start_time = ?, active_end_time = ? where effective_from = ?',
        [availableHoursPerDay, activeStartTime, activeEndTime, FIRST_DAY_SETTINGS]
      );
    });

    await get().fetchTimeSettings();
    await get().fetchTimeSummary();
  },

  fetchTimeSummary: async () => {
    const settings = get().settings;
    if (!settings) {
      set({ todayMinutes: 0, pastMinutes: 0 });
      return;
    }

    try {
      const today = localDateStr();
      const past = await dbGet<{ m: number | null }>(
        'select sum(minutes) as m from time_logs where date >= ? and date <= ?',
        [settings.startDate, today]
      );
      const todaySum = await dbGet<{ m: number | null }>('select sum(minutes) as m from time_logs where date = ?', [today]);
      set({ pastMinutes: past?.m ?? 0, todayMinutes: todaySum?.m ?? 0 });
    } catch (e) {
      console.error('[useTimeStore] fetchTimeSummary', e instanceof Error ? e.message : 'error');
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
    await get().fetchTimeSummary();
    await get().fetchRecentLogs();
  },

  updateTimeLog: async (id, title, content, minutes) => {
    await dbRun('update time_logs set title = ?, content = ?, minutes = ?, updated_at = ? where id = ?', [
      title,
      content,
      minutes,
      new Date().toISOString(),
      id,
    ]);
    await get().fetchTimeSummary();
    await get().fetchRecentLogs();
  },

  deleteTimeLog: async (id) => {
    await dbRun('delete from time_logs where id = ?', [id]);
    await get().fetchTimeSummary();
    await get().fetchRecentLogs();
  },
}));
