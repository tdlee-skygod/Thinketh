import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import type { GoalCategory } from '@/types';

interface GoalCategoryRow {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

function mapGoalCategory(row: GoalCategoryRow): GoalCategory {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

interface GoalCategoryState {
  categories: GoalCategory[];
  isLoading: boolean;
  fetchGoalCategories: () => Promise<void>;
  addGoalCategory: (name: string) => Promise<void>;
  deleteGoalCategory: (id: string) => Promise<boolean>;
}

export const useGoalCategoryStore = create<GoalCategoryState>((set, get) => ({
  categories: [],
  isLoading: false,

  fetchGoalCategories: async () => {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;

    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('thinketh_goal_categories')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      set({ categories: (data ?? []).map(mapGoalCategory) });
    } finally {
      set({ isLoading: false });
    }
  },

  addGoalCategory: async (name) => {
    const userId = useAuthStore.getState().session?.user.id;
    if (!userId) return;

    const sortOrder = get().categories.length;
    const tempId = `temp-${Date.now()}`;
    const optimistic: GoalCategory = {
      id: tempId,
      userId,
      name,
      sortOrder,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ categories: [...state.categories, optimistic] }));

    const { data, error } = await supabase
      .from('thinketh_goal_categories')
      .insert({ user_id: userId, name, sort_order: sortOrder })
      .select()
      .single();

    if (error || !data) {
      set((state) => ({ categories: state.categories.filter((c) => c.id !== tempId) }));
      throw error;
    }

    set((state) => ({
      categories: state.categories.map((c) => (c.id === tempId ? mapGoalCategory(data) : c)),
    }));
  },

  // 소속 목표가 있으면 삭제하지 않는다 (D-222 — 문구 카테고리의 cascade 삭제와 반대 규칙).
  deleteGoalCategory: async (id) => {
    const { count, error: countError } = await supabase
      .from('thinketh_goals')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id);

    if (countError) throw countError;
    if (count && count > 0) return false;

    const prev = get().categories;
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));

    const { error } = await supabase.from('thinketh_goal_categories').delete().eq('id', id);
    if (error) {
      set({ categories: prev });
      throw error;
    }
    return true;
  },
}));
