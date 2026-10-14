import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { GoalAspiration } from '@/types';

interface GoalAspirationRow {
  id: string;
  user_id: string;
  goal_id: string;
  date: string;
  content: string;
  created_at: string;
}

function mapGoalAspiration(row: GoalAspirationRow): GoalAspiration {
  return {
    id: row.id,
    userId: row.user_id,
    goalId: row.goal_id,
    date: row.date,
    content: row.content,
    createdAt: row.created_at,
  };
}

interface GoalAspirationState {
  aspirationsByGoal: Record<string, GoalAspiration[]>; // date 내림차순
  isLoading: boolean;
  fetchAspirations: (goalId: string) => Promise<void>;
}

// 열망(F-20)은 Claude Desktop 등 외부에서 주기적으로 기록하는 것을 전제로 하며,
// 앱에서는 조회 + 음성 읽어주기(TTS)만 제공한다 (D-222) — 작성/수정 액션은 두지 않는다.
export const useGoalAspirationStore = create<GoalAspirationState>((set) => ({
  aspirationsByGoal: {},
  isLoading: false,

  fetchAspirations: async (goalId) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('thinketh_goal_aspirations')
        .select('*')
        .eq('goal_id', goalId)
        .order('date', { ascending: false });

      if (error) throw error;
      set((state) => ({
        aspirationsByGoal: { ...state.aspirationsByGoal, [goalId]: (data ?? []).map(mapGoalAspiration) },
      }));
    } finally {
      set({ isLoading: false });
    }
  },
}));
