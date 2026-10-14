// 나의 시간 설정 (F-21) — 화면용 합성 뷰.
// 저장은 rate_periods(비용 기간 1개, 단계 1에서 다중 기간으로 확장)와 day_settings 두 테이블이 나눠 한다.
export interface TimeSettings {
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  hourlyRate: number;     // 원
  availableHoursPerDay: number;   // 하루 가용시간(1~24), 기본 8
  activeStartTime: string; // 'HH:MM', 실시간 버려진 시간 누적 시작 시각, 기본 06:00
  activeEndTime: string;   // 'HH:MM', 실시간 버려진 시간 확정 시각, 기본 22:00
}

// 시간당 비용 기간 (F-24, D-239)
export interface RatePeriod {
  id: string;
  startDate: string;      // YYYY-MM-DD
  endDate: string;
  hourlyRate: number;     // 원/시간
}

// 날짜별 적용 설정 (day_settings, D-250)
export interface DaySettings {
  effectiveFrom: string;  // YYYY-MM-DD, 최초 행은 '0001-01-01'
  availableHoursPerDay: number;
  activeStartTime: string;
  activeEndTime: string;
}

// 오늘의 의미있는 일 기록 (F-21, 하루 여러 건) — 단위는 분(D-239)
export interface TimeLog {
  id: string;
  date: string;           // YYYY-MM-DD, KST 기준
  title: string;
  content: string;
  minutes: number;
  createdAt: string;
  updatedAt: string;
}

// 비용 기간 검증 결과 (D-239) — 화면이 그대로 안내 문구로 쓴다
export interface RateIssue {
  kind: 'inverted' | 'overlap' | 'gap';
  message: string;
}

// 수정 가능 여부 판정 결과 (D-250) — 화면이 읽기 전용 안내에 사용
export interface EditCheck {
  editable: boolean;
  reason: 'past_date' | 'past_period' | 'past_settings' | null;
}

// DB 열기 결과 (D-253)
export type DbOpenResult =
  | { ok: true }
  | { ok: false; reason: 'newer_version' | 'key_mismatch' | 'corrupted' | 'transient' };
