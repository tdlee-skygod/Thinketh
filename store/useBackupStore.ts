import { create } from 'zustand';
import { applyImport, createBackupFile, prepareImport, shareBackupFile } from '@/lib/backup';
import type { ImportSummary } from '@/lib/backup';
import { useRateStore } from '@/store/useRateStore';
import { useTimeStore } from '@/store/useTimeStore';
import type { BackupMode } from '@/types';

// 내보내기/가져오기 (F-25). 화면은 이 스토어만 호출하고, 비밀번호는 상태에 저장하지 않는다 (D-244).

interface BackupState {
  isBusy: boolean;
  exportBackup: (password: string) => Promise<void>;
  importBackup: (uri: string, password: string, mode: BackupMode) => Promise<ImportSummary>;
}

export const useBackupStore = create<BackupState>((set) => ({
  isBusy: false,

  exportBackup: async (password) => {
    set({ isBusy: true });
    try {
      const uri = await createBackupFile(password);
      await shareBackupFile(uri);
    } finally {
      set({ isBusy: false });
    }
  },

  importBackup: async (uri, password, mode) => {
    set({ isBusy: true });
    try {
      const payload = await prepareImport(uri, password);
      const summary = await applyImport(payload, mode);
      // 가져온 데이터를 화면에 반영한다. 알림·위젯·마일스톤 재계산은 해당 기능이 생기는 단계에서 이어 붙인다
      await Promise.all([
        useRateStore.getState().fetchPeriods(),
        useTimeStore.getState().fetchDaySettings(),
        useTimeStore.getState().fetchSummary(),
        useTimeStore.getState().fetchRecentLogs(),
      ]);
      return summary;
    } finally {
      set({ isBusy: false });
    }
  },
}));
