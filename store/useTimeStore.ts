import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { localDateStr, shiftDateStr } from '@/lib/date';
import type { TimeSettings, TimeLog } from '@/types';

const RECENT_LOG_DAYS = 3;

interface TimeSettingsRow {
  user_id: string;
  start_date: string;
  end_date: string;
  hourly_rate: number;
  available_hours_per_day: number;
  active_start_time: string;
  active_end_time: string;
}

interface TimeLogRow {
  id: string;
  user_id: string;
  date: string;
  title: string;
  content: string;
  hours: number;
  created_at: string;
  updated_at: string;
}

function mapTimeSettings(row: TimeSettingsRow): TimeSettings {
  return {
    userId: row.user_id,
    startDate: row.start_date,
    endDate: row.end_date,
    hourlyRate: row.hourly_rate,
    availableHoursPerDay: row.available_hours_per_day,
    activeStartTime: row.active_start_time.slice(0, 5),
    activeEndTime: row.active_end_time.slice(0, 5),
  };
}

function mapTimeLog(row: TimeLogRow): TimeLog {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    title: row.title,
    content: row.content,
    hours: row.hours,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface TimeState {
  settings: TimeSettings | null;
  todayHours: number;    // 오늘 나의 시간 합계
  pastHours: number;     // 시작일~오늘 나의 시간 누적 합계
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
  addTimeLog: (title: string, content: string, hours: number) => Promise<void>;
  updateTimeLog: (id: string, title: string, content: string, hours: number) => Promise<void>;
  deleteTimeLog: (id: string) => Promise<void>;
}

export const useTimeStore = create<TimeState>((set, get) => ({
  settings: null,
  todayHours: 0,
  pastHours: 0,
  recentLogs: [],
  isLoading: false,

  fetchTimeSettings: async () => {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return null;

    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('thinketh_time_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      const mapped = data ? mapTimeSettings(data) : null;
      set({ settings: mapped });
      return mapped;
    } catch (e) {
      console.error('[useTimeStore] fetchTimeSettings', e);
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  saveTimeSettings: async (startDate, endDate, hourlyRate, availableHoursPerDay, activeStartTime, activeEndTime) => {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from('thinketh_time_settings')
      .upsert(
        {
          user_id: userId,
          start_date: startDate,
          end_date: endDate,
          hourly_rate: hourlyRate,
          available_hours_per_day: availableHoursPerDay,
          active_start_time: activeStartTime,
          active_end_time: activeEndTime,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error || !data) throw error;

    set({ settings: mapTimeSettings(data) });
    await get().fetchTimeSummary();
  },

  fetchTimeSummary: async () => {
    const userId = useAuthStore.getState().session?.user.id;
    const settings = get().settings;
    if (!userId || !settings) {
      set({ todayHours: 0, pastHours: 0 });
      return;
    }

    const today = localDateStr();
    const { data, error } = await supabase
      .from('thinketh_time_logs')
      .select('date, hours')
      .eq('user_id', userId)
      .gte('date', settings.startDate)
      .lte('date', today);

    if (error) {
      console.error('[useTimeStore] fetchTimeSummary', error);
      return;
    }

    let todayHours = 0;
    let pastHours = 0;
    for (const row of data ?? []) {
      pastHours += row.hours;
      if (row.date === today) todayHours += row.hours;
    }
    set({ todayHours, pastHours });
  },

  fetchRecentLogs: async () => {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;

    const since = shiftDateStr(localDateStr(), -(RECENT_LOG_DAYS - 1));
    const { data, error } = await supabase
      .from('thinketh_time_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('date', since)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[useTimeStore] fetchRecentLogs', error);
      return;
    }
    set({ recentLogs: (data ?? []).map(mapTimeLog) });
  },

  addTimeLog: async (title, content, hours) => {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;

    const today = localDateStr();
    const prevToday = get().todayHours;
    const prevPast = get().pastHours;
    const prevLogs = get().recentLogs;
    set({ todayHours: prevToday + hours, pastHours: prevPast + hours });

    const { data, error } = await supabase
      .from('thinketh_time_logs')
      .insert({ user_id: userId, date: today, title, content, hours })
      .select()
      .single();

    if (error || !data) {
      set({ todayHours: prevToday, pastHours: prevPast });
      throw error;
    }

    set({ recentLogs: [mapTimeLog(data), ...prevLogs] });
  },

  updateTimeLog: async (id, title, content, hours) => {
    const userId = useAuthStore.getState().session?.user.id;
    const settings = get().settings;
    const existing = get().recentLogs.find((l) => l.id === id);
    if (!userId || !existing) return;

    const today = localDateStr();
    const hoursDelta = hours - existing.hours;
    const prevToday = get().todayHours;
    const prevPast = get().pastHours;
    const prevLogs = get().recentLogs;

    const inPastRange = !settings || existing.date >= settings.startDate;
    set({
      recentLogs: prevLogs.map((l) => (l.id === id ? { ...l, title, content, hours } : l)),
      todayHours: existing.date === today ? prevToday + hoursDelta : prevToday,
      pastHours: inPastRange ? prevPast + hoursDelta : prevPast,
    });

    const { error } = await supabase
      .from('thinketh_time_logs')
      .update({ title, content, hours, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      set({ recentLogs: prevLogs, todayHours: prevToday, pastHours: prevPast });
      throw error;
    }
  },

  deleteTimeLog: async (id) => {
    const userId = useAuthStore.getState().session?.user.id;
    const settings = get().settings;
    const existing = get().recentLogs.find((l) => l.id === id);
    if (!userId || !existing) return;

    const today = localDateStr();
    const prevToday = get().todayHours;
    const prevPast = get().pastHours;
    const prevLogs = get().recentLogs;

    const inPastRange = !settings || existing.date >= settings.startDate;
    set({
      recentLogs: prevLogs.filter((l) => l.id !== id),
      todayHours: existing.date === today ? prevToday - existing.hours : prevToday,
      pastHours: inPastRange ? prevPast - existing.hours : prevPast,
    });

    const { error } = await supabase.from('thinketh_time_logs').delete().eq('id', id);

    if (error) {
      set({ recentLogs: prevLogs, todayHours: prevToday, pastHours: prevPast });
      throw error;
    }
  },
}));
