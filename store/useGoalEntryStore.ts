import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import type { GoalEntry } from '@/types';

interface GoalEntryRow {
  id: string;
  user_id: string;
  goal_id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function mapGoalEntry(row: GoalEntryRow): GoalEntry {
  return {
    id: row.id,
    userId: row.user_id,
    goalId: row.goal_id,
    date: row.date,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface GoalEntryState {
  entriesByGoal: Record<string, GoalEntry[]>; // date 내림차순
  entryCounts: Record<string, number>;
  isLoading: boolean;
  fetchEntryCounts: () => Promise<void>;
  fetchEntries: (goalId: string) => Promise<void>;
  saveEntry: (goalId: string, date: string, content: string) => Promise<void>;
  deleteEntry: (goalId: string, date: string) => Promise<void>;
}

export const useGoalEntryStore = create<GoalEntryState>((set, get) => ({
  entriesByGoal: {},
  entryCounts: {},
  isLoading: false,

  fetchEntryCounts: async () => {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from('thinketh_goal_entries')
      .select('goal_id')
      .eq('user_id', userId);

    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.goal_id] = (counts[row.goal_id] ?? 0) + 1;
    }
    set({ entryCounts: counts });
  },

  fetchEntries: async (goalId) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('thinketh_goal_entries')
        .select('*')
        .eq('goal_id', goalId)
        .order('date', { ascending: false });

      if (error) throw error;
      set((state) => ({
        entriesByGoal: { ...state.entriesByGoal, [goalId]: (data ?? []).map(mapGoalEntry) },
      }));
    } finally {
      set({ isLoading: false });
    }
  },

  saveEntry: async (goalId, date, content) => {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from('thinketh_goal_entries')
      .upsert(
        { user_id: userId, goal_id: goalId, date, content, updated_at: new Date().toISOString() },
        { onConflict: 'goal_id,date' }
      )
      .select()
      .single();

    if (error || !data) throw error;

    const saved = mapGoalEntry(data);
    set((state) => {
      const existing = state.entriesByGoal[goalId] ?? [];
      const isNew = !existing.some((e) => e.date === date);
      const nextEntries = isNew
        ? [saved, ...existing].sort((a, b) => (a.date < b.date ? 1 : -1))
        : existing.map((e) => (e.date === date ? saved : e));

      return {
        entriesByGoal: { ...state.entriesByGoal, [goalId]: nextEntries },
        entryCounts: isNew
          ? { ...state.entryCounts, [goalId]: (state.entryCounts[goalId] ?? 0) + 1 }
          : state.entryCounts,
      };
    });
  },

  deleteEntry: async (goalId, date) => {
    const prevEntries = get().entriesByGoal;
    const prevCounts = get().entryCounts;
    const existing = prevEntries[goalId] ?? [];
    if (!existing.some((e) => e.date === date)) return;

    set({
      entriesByGoal: { ...prevEntries, [goalId]: existing.filter((e) => e.date !== date) },
      entryCounts: { ...prevCounts, [goalId]: Math.max((prevCounts[goalId] ?? 1) - 1, 0) },
    });

    const { error } = await supabase
      .from('thinketh_goal_entries')
      .delete()
      .eq('goal_id', goalId)
      .eq('date', date);

    if (error) {
      set({ entriesByGoal: prevEntries, entryCounts: prevCounts });
      throw error;
    }
  },
}));
