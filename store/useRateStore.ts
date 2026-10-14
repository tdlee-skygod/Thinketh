import { create } from 'zustand';
import { dbAll, dbRun, dbTransaction } from '@/lib/localDb';
import { localDateStr } from '@/lib/date';
import { checkPeriodEdit, sortPeriods, validatePeriods } from '@/lib/rates';
import type { EditCheck, RateIssue, RatePeriod } from '@/types';

// 시간당 비용 기간 (F-24, D-239, D-250). 검증·수정 가능 판정은 lib/rates.ts의 순수 함수를 감싼다.

interface RatePeriodRow {
  id: string;
  start_date: string;
  end_date: string;
  hourly_rate: number;
}

function mapPeriod(row: RatePeriodRow): RatePeriod {
  return { id: row.id, startDate: row.start_date, endDate: row.end_date, hourlyRate: row.hourly_rate };
}

export type SavePeriodsResult = { ok: true } | { ok: false; message: string };

const LOCKED_MESSAGE =
  '지난 날짜가 포함된 기간은 단가와 시작일을 바꾸거나 삭제할 수 없어요. 새 단가는 "내일부터 새 단가 적용"을 이용해 주세요.';

interface RateState {
  periods: RatePeriod[];   // start_date 오름차순
  isLoading: boolean;
  fetchPeriods: () => Promise<void>;
  validate: (draft: RatePeriod[]) => RateIssue[];
  checkEdit: (before: RatePeriod[], after: RatePeriod[]) => EditCheck;
  savePeriods: (draft: RatePeriod[]) => Promise<SavePeriodsResult>;   // validate·checkEdit 통과 시에만 트랜잭션 저장
}

export const useRateStore = create<RateState>((set, get) => ({
  periods: [],
  isLoading: false,

  fetchPeriods: async () => {
    set({ isLoading: true });
    try {
      const rows = await dbAll<RatePeriodRow>('select id, start_date, end_date, hourly_rate from rate_periods order by start_date');
      set({ periods: rows.map(mapPeriod) });
    } catch (e) {
      console.error('[useRateStore] fetchPeriods', e instanceof Error ? e.message : 'error');
    } finally {
      set({ isLoading: false });
    }
  },

  validate: (draft) => validatePeriods(draft),

  checkEdit: (before, after) => checkPeriodEdit(before, after, localDateStr()),

  savePeriods: async (draft) => {
    const issues = validatePeriods(draft);
    if (issues.length > 0) return { ok: false, message: issues[0].message };

    const before = get().periods;
    if (!checkPeriodEdit(before, draft, localDateStr()).editable) return { ok: false, message: LOCKED_MESSAGE };

    await dbTransaction(async () => {
      await dbRun('delete from rate_periods');
      for (const p of sortPeriods(draft)) {
        await dbRun('insert into rate_periods (id, start_date, end_date, hourly_rate) values (?, ?, ?, ?)', [
          p.id,
          p.startDate,
          p.endDate,
          p.hourlyRate,
        ]);
      }
    });
    await get().fetchPeriods();
    return { ok: true };
  },
}));
