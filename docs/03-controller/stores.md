# Zustand 스토어 설계 — Thinketh

> 표기: 📝 v2 계획(코드 미반영). 모든 스토어는 로컬 DB(`lib/localDb`)를 사용하고 `userId`가 없다(D-234).
> 현재 코드의 `useAuthStore`·`useGoal*Store`·`useVoiceFocusStore`와 Supabase 기반 `useTimeStore`는 단계 0에서 삭제·교체한다(D-238, D-240).

## useLockStore ✅ (F-23, 단계 0 조각 3 — 빌드 검증 전)

```typescript
interface LockState {
  status: 'loading' | 'needs_setup' | 'locked' | 'unlocked';
  biometricEnabled: boolean;
  lockTimeoutSec: number;                           // SecureStore에 저장(DB 열기 전에 필요), 기본 30
  failCount: number;
  lockUntilMs: number | null;                       // 연속 실패 대기 종료 시각(epoch ms)
  backgroundedAt: number | null;
  init: () => Promise<void>;                        // SecureStore 상태 읽기, 초기 상태 결정
  setupPin: (pin: string, enableBiometric: boolean) => Promise<void>;   // 첫 설정, 기기 잠금 인증 뒤 재설정에도 사용
  checkPin: (pin: string) => Promise<'ok' | 'wrong' | 'wait'>;          // 실패 횟수·대기 시간 반영, 상태는 바꾸지 않음
  unlock: (pin: string) => Promise<'ok' | 'wrong' | 'wait'>;
  unlockWithBiometric: () => Promise<boolean>;
  authenticateDevice: (message: string) => Promise<boolean>;            // 기기 잠금 인증(PIN 분실 시 재설정 전 단계)
  changePin: (newPin: string) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  setLockTimeoutSec: (sec: number) => Promise<void>;
  onBackground: () => void;                         // AppState 전환 시각 기록
  onForeground: () => void;                         // timeout 경과 시 locked
}
```

잠금 판단은 `AppState` 전환 시각과 `settings.lock_timeout_sec`로 한다. 잠금 상태에서는 어떤 화면도 렌더링하지 않고 lock 화면만 보인다.

## useRateStore ✅ (F-24, D-239·D-250 — 단계 1-A, 빌드 검증 전)

```typescript
interface RateState {
  periods: RatePeriod[];                            // start_date 오름차순
  fetchPeriods: () => Promise<void>;
  validate: (draft: RatePeriod[]) => RateIssue[];   // 겹침, 빈 날, 종료일<시작일
  savePeriods: (draft: RatePeriod[]) => Promise<{ ok: true } | { ok: false; message: string }>;   // validate·checkPeriodEdit 통과 시에만 트랜잭션 저장, 실패는 화면에 안내할 문구로 반환
  checkEdit: (before: RatePeriod[], after: RatePeriod[]) => EditCheck;   // 시작일이 오늘 이전인 기간의 단가·시작일 변경·삭제는 거부(D-250)
  autoAdjustAfterEdit: (periods: RatePeriod[], editedId: string) => RatePeriod[];   // 종료일 변경 시 다음 기간 시작일 맞춤
}
```

`validate`/`autoAdjustAfterEdit`는 `lib/rates.ts`의 순수 함수를 감싼다. 기간이 하나도 없으면 Time 탭은 "비용 기간 등록" 빈 상태가 된다. 중간 기간 삭제는 이웃 기간을 늘려 메우는 경우에만 허용한다.

## useTimeStore (Time 탭, F-21)

> ✅ 단계 1-A 구현: `daySettings`(날짜별 적용값 목록), `dailyMinutes`(날짜→분), `recentLogs`, `fetchDaySettings`/`saveDaySettings`(기록·기간이 없으면 즉시, 있으면 내일 행 upsert)/`fetchSummary`/`fetchRecentLogs`/`addTimeLog`/`updateTimeLog`/`deleteTimeLog`. 수정·삭제는 오늘 기록만 가능하고 지난 날이면 저장하지 않고 `EditCheck`를 돌려준다(D-250). `closings`·`closePastDays`는 단계 2에서 추가한다.

## useTimeStore 최종 인터페이스 📝

```typescript
interface TimeState {
  settings: AppSettings | null;
  daySettings: DaySettings[];             // effective_from 오름차순. 날짜별 적용값 조회(daySettingsOn)에 사용
  dailyMinutes: Record<string, number>;   // 날짜 → 나의 시간 합계(분). 단가 적용·스트릭·통계의 공통 입력
  closings: Record<string, DayClosing>;   // 날짜 → 확정 값(지난 날)
  recentLogs: TimeLog[];                  // 최근 3일 (date desc, 같은 날 최신순)
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;
  saveDaySettings: (patch: Partial<Omit<DaySettings, 'effectiveFrom'>>) => Promise<void>;   // 내일 적용 행 upsert(D-250)
  fetchSummary: () => Promise<void>;      // 전체 기간의 날짜별 합계·확정 값 로드
  closePastDays: () => Promise<void>;     // 확정 행이 없는 지난 날짜를 오래된 순으로 확정(D-251). 앱 시작·복귀·자정 롤오버
  fetchRecentLogs: () => Promise<void>;
  addTimeLog: (title: string, content: string, minutes: number, tagId: string | null) => Promise<void>;
  updateTimeLog: (id: string, patch: { title?: string; content?: string; minutes?: number; tagId?: string | null }) => Promise<void>;
  deleteTimeLog: (id: string) => Promise<void>;
}
```

- 기존 `todayHours`/`pastHours` 누적 합계는 사라지고, 날짜별 합계(`dailyMinutes`)로 바뀐다. 금액은 화면이 `lib/rates.ts`로 날짜별 단가를 곱해 계산한다(D-239).
- 기록 추가·수정·삭제는 저장 전에 `isEditableDate(date)`로 검사하고(오늘만 가능, D-250), 거부되면 `EditCheck.reason`을 화면에 넘긴다.
- 기록을 저장·수정·삭제하면 DB 트랜잭션이 끝난 뒤 ① 알림 재예약 ② 위젯 값 갱신 ③ 마일스톤 검사 ④ 스트릭 재계산을 **서로 독립적으로** 호출한다. 하나가 실패해도 저장 결과는 성공이다(D-252).
- 현재 코드의 `useTimeStore`(Supabase 기반, `todayHours`/`pastHours`)는 이 인터페이스로 **전면 교체**한다.

## useTimerStore 📝 (F-27)

```typescript
interface TimerStoreState {
  timer: TimerState | null;               // DB에 저장된 진행 중 타이머 (앱 재시작 후에도 유지)
  elapsedMinutes: number;                 // now − startedAt, 매초 갱신
  start: (tagId: string | null, title: string) => Promise<void>;
  stopAndSave: (confirmLong?: boolean) => Promise<void>;   // 자정을 넘기면 날짜별로 나눠 time_logs 저장
  cancel: () => Promise<void>;
}
```

최대 12시간을 넘기면 `stopAndSave`가 확인을 요구하고, 지금 시각이 `startedAt`보다 이전(시계 역행)이면 저장을 거부한다. `elapsedMinutes`는 항상 0 이상이다. 0.01시간(약 36초) 미만은 올림해 1분 이상으로 저장한다. 타이머 진행 시간은 `lib/timeTicker.computeLiveWastedHours`의 "나의 시간"에 더해 버려진 금액이 늘지 않게 한다.

## useStreakStore 📝 (F-26)

```typescript
interface StreakState {
  streak: StreakResult;
  todayProgress: { minutes: number; goalMinutes: number; ratio: number };
  refresh: () => void;                    // dailyMinutes, settings로 lib/streak 호출 (저장 없음)
}
```

## useNotifyStore 📝 (F-28)

```typescript
interface NotifyState {
  prefs: NotifyPref[];                    // 기본 모두 enabled=false
  fetchPrefs: () => Promise<void>;
  setEnabled: (kind: NotifyKind, enabled: boolean) => Promise<void>;   // 켤 때 권한 요청
  setTime: (kind: NotifyKind, timeKst: string) => Promise<void>;
  rescheduleAll: () => Promise<void>;     // lib/notifications 호출
}
```

## useTagStore / useRewardStore / useReflectionStore 📝 (F-29 · F-30 · F-31)

```typescript
interface TagState { tags: Tag[]; fetchTags(): Promise<void>; addTag(name: string, color: string): Promise<void>; deleteTag(id: string): Promise<void>; }   // 삭제 시 기록은 미분류
interface RewardState { rewards: Reward[]; fetchRewards(): Promise<void>; setRewardText(threshold: number, text: string): Promise<void>; checkAchievements(totalMoney: number): Promise<Reward[]>; }   // 새로 달성한 단계만 반환, achieved_at은 한 번 기록되면 유지
interface ReflectionState { reflections: Reflection[]; fetchReflections(): Promise<void>; saveReflection(date: string, content: string): Promise<void>; }   // 오늘 것만 저장 가능(D-250)
```

## useBackupStore ✅ (F-25, 단계 1-B — 빌드 검증 전)

```typescript
interface BackupState {
  isBusy: boolean;
  exportBackup: (password: string) => Promise<void>;                                       // 파일 생성 → 공유 시트 → 임시 파일 삭제
  importBackup: (uri: string, password: string, mode: BackupMode) => Promise<ImportSummary>; // 복호화·검증 → 트랜잭션 반영 → 관련 스토어 재조회
}
```

비밀번호는 상태에 저장하지 않는다. 알림·위젯·마일스톤 재계산은 해당 기능이 생기는 단계에서 `importBackup` 끝에 이어 붙인다. DB가 닫힌 복구 화면(`DbRecovery`)은 스토어를 쓸 수 없어 `lib/backup`을 직접 호출한다(예외).

## 원칙

- 스토어만 `lib/localDb`를 호출한다. 화면은 스토어만 호출한다(D-001).
- 같은 DB 쓰기는 한 곳(해당 스토어)에서만 한다. 다른 스토어가 같은 테이블에 직접 쓰지 않는다.
- 다른 스토어의 값을 한 번만 읽을 때는 `useXStore.getState()`를 쓴다(구독 불필요한 단발 조회).
- 배열·객체 셀렉터 폴백은 모듈 스코프의 고정 참조를 쓴다(D-225).
- `lib/`는 store를 import하지 않는다.
- 낙관적 업데이트는 필요한 곳에서만 쓴다(architecture-mvc.md).
- 성공 피드백은 `Toast`, 실패는 `Alert.alert`(D-228).
- 기록·기간·설정의 수정 가능 여부는 날짜 비교로 판정한다. `day_closings` 유무에 의존하지 않는다(D-250).
