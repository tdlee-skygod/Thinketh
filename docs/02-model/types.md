# TypeScript 타입 정의 — Thinketh

> `types/index.ts`에 정의한다. 로컬 DB 스키마([db-schema.md](db-schema.md))와 1:1 대응한다. 서버·계정이 없어 `userId`가 없다. 표기: 📝 v2 계획(코드 미반영).

```typescript
// 앱 설정 (settings, 1행) — 과거 계산에 영향이 없는 값. 자동 잠금 시간은 SecureStore(lib/secure.ts)에 둔다
export interface AppSettings {
  compoundRatePct: number;        // 연 %, 기본 5
  widgetShowAmount: boolean;      // 기본 false
}

// 날짜별 적용 설정 (day_settings, D-250) — 변경은 내일부터 적용
export interface DaySettings {
  effectiveFrom: string;          // YYYY-MM-DD, 최초 행은 '0001-01-01'
  availableHoursPerDay: number;   // 1~24, 기본 8
  activeStartTime: string;        // 'HH:MM', 기본 06:00
  activeEndTime: string;          // 'HH:MM', 기본 22:00
  dailyGoalMinutes: number;       // 기본 120
  streakMinMinutes: number;       // 기본 60
}

// 시간당 비용 기간 (F-24, D-239)
export interface RatePeriod {
  id: string;
  startDate: string;              // YYYY-MM-DD
  endDate: string;
  hourlyRate: number;             // 원/시간
}

// 시간 기록 (F-21) — 단위는 분
export interface TimeLog {
  id: string;
  date: string;
  title: string;
  content: string;
  minutes: number;
  tagId: string | null;           // null = 미분류
  createdAt: string;
  updatedAt: string;
}

// 일 단위 확정 (F-34, D-251) — 하루가 지난 날의 스냅샷
export interface DayClosing {
  date: string;
  availableMinutes: number;
  myMinutes: number;
  wastedMinutes: number;
  hourlyRate: number;
  myAmount: number;               // 원
  wastedAmount: number;           // 원
  closedAt: string;
}

// 태그 (F-29)
export interface Tag {
  id: string;
  name: string;
  color: string;                  // HEX
}

// 진행 중 타이머 (F-27) — 없으면 null
export interface TimerState {
  startedAt: string;              // ISO
  tagId: string | null;
  title: string;
}

// 마일스톤 보상 (F-30)
export interface Reward {
  threshold: number;              // 원
  rewardText: string;
  achievedAt: string | null;
}

// 회고 (F-31)
export interface Reflection {
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 알림 설정 (F-28)
export type NotifyKind = 'loss_am' | 'loss_pm' | 'loss_eve' | 'reflection' | 'milestone';
export interface NotifyPref {
  kind: NotifyKind;
  enabled: boolean;               // 기본 false
  timeKst: string | null;         // 'HH:MM'
}

// 계산 결과 (store/lib에서 파생, DB에 저장하지 않음)
export interface StreakResult {
  current: number;
  best: number;
  freezeUsedDates: string[];      // 이번 계산에서 프리즈로 이어 준 날짜(저장 안 함, D-242)
  todayAchieved: boolean;
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

// 내보내기 파일의 평문 구조 (암호화 전, D-237). 구현(단계 1-B)은 daySettings·ratePeriods·timeLogs만 포함하며, 이후 단계의 테이블은 필드를 추가한다(formatVersion 유지, 없으면 빈 배열)
export interface BackupPayload {
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  settings: AppSettings;
  daySettings: DaySettings[];
  ratePeriods: RatePeriod[];
  tags: Tag[];
  timeLogs: TimeLog[];
  dayClosings: DayClosing[];
  rewards: Reward[];
  reflections: Reflection[];
  notifyPrefs: NotifyPref[];
}
```

> `타이머`(`TimerState`)와 PIN·DB 키는 백업 파일에 포함하지 않는다(PIN은 SecureStore, 타이머는 일시 상태).
