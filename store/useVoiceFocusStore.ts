import { create } from 'zustand';

interface VoiceFocusState {
  ownerId: string | null;
  claim: (id: string) => void;
  release: (id: string) => void;
}

// 목표 입력창과 다짐 팝업 입력창은 같은 네이티브 음성 인식 세션을 공유한다.
// 포커스 전환 시 blur 이벤트가 누락되는 경우(예: 뒤로가기로 키보드만 닫힌 경우)에도
// 마지막으로 포커스를 가져간 입력창만 인식 결과를 받도록 소유권을 명시적으로 관리한다.
export const useVoiceFocusStore = create<VoiceFocusState>((set, get) => ({
  ownerId: null,
  claim: (id) => set({ ownerId: id }),
  release: (id) => {
    if (get().ownerId === id) set({ ownerId: null });
  },
}));
