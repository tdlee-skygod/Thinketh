import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  init: () => void;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

async function selectProfile(userId: string) {
  return supabase.from('thinketh_profiles').select('*').eq('id', userId).maybeSingle();
}

async function fetchProfile(userId: string, email: string): Promise<Profile | null> {
  let { data, error } = await selectProfile(userId);

  if (error) {
    console.error('[useAuthStore] fetchProfile', error);
    return null;
  }

  // 트리거가 아직 처리되지 않았거나(가입 직후 지연) 트리거 도입 이전에 만든 계정이면
  // 행이 없을 수 있다 — 기본값으로 새로 만들어 자기 복구한다.
  if (!data) {
    const { error: insertError } = await supabase
      .from('thinketh_profiles')
      .insert({ id: userId, email, display_name: '' });

    // 23505 = 동시에 다른 fetchProfile 호출이 먼저 생성함(레이스 컨디션) — 정상 상황, 다시 조회하면 된다.
    if (insertError && insertError.code !== '23505') {
      console.error('[useAuthStore] fetchProfile insert', insertError);
      return null;
    }

    const retry = await selectProfile(userId);
    if (retry.error || !retry.data) {
      console.error('[useAuthStore] fetchProfile retry', retry.error);
      return null;
    }
    data = retry.data;
  }

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    createdAt: data.created_at,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isLoading: false,
  isInitialized: false,

  init: () => {
    // onAuthStateChange는 구독 직후 현재 세션 상태로 한 번 즉시 호출된다(INITIAL_SESSION) —
    // 별도로 getSession()을 또 호출하면 앱 시작 시 fetchProfile이 동시에 두 번 실행되어
    // 자기 복구 insert가 서로 경합하는 레이스 컨디션이 생긴다(D-216).
    supabase.auth.onAuthStateChange(async (_event, session) => {
      const profile = session ? await fetchProfile(session.user.id, session.user.email ?? '') : null;
      set({ session, profile, isInitialized: true });
    });
  },

  signUp: async (email, password, displayName) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) throw error;
      return { needsEmailConfirmation: !data.session };
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },
}));
