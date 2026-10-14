import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import type { Goal } from '@/types';

interface GoalRow {
  id: string;
  user_id: string;
  category_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

function mapGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface GoalState {
  goals: Goal[];
  isLoading: boolean;
  fetchGoals: () => Promise<void>;
  addGoal: (categoryId: string, text: string) => Promise<void>;
  updateGoal: (id: string, text: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

export const useGoalStore = create<GoalState>((set, get) => ({
  goals: [],
  isLoading: false,

  fetchGoals: async () => {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;

    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('thinketh_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ goals: (data ?? []).map(mapGoal) });
    } finally {
      set({ isLoading: false });
    }
  },

  addGoal: async (categoryId, text) => {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;

    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: Goal = {
      id: tempId,
      userId,
      categoryId,
      text,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ goals: [optimistic, ...state.goals] }));

    const { data, error } = await supabase
      .from('thinketh_goals')
      .insert({ user_id: userId, category_id: categoryId, text })
      .select()
      .single();

    if (error || !data) {
      set((state) => ({ goals: state.goals.filter((g) => g.id !== tempId) }));
      throw error;
    }

    set((state) => ({
      goals: state.goals.map((g) => (g.id === tempId ? mapGoal(data) : g)),
    }));
  },

  updateGoal: async (id, text) => {
    const prev = get().goals;
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id ? { ...g, text } : g)),
    }));

    const { error } = await supabase
      .from('thinketh_goals')
      .update({ text, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      set({ goals: prev });
      throw error;
    }
  },

  deleteGoal: async (id) => {
    const prev = get().goals;
    set((state) => ({ goals: state.goals.filter((g) => g.id !== id) }));

    const { error } = await supabase.from('thinketh_goals').delete().eq('id', id);
    if (error) {
      set({ goals: prev });
      throw error;
    }
  },
}));
