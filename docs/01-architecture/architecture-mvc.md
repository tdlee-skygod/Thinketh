# MVC 아키텍처 — Thinketh

> 새 파일 추가 전, 화면/로직 분리 전 반드시 확인.
> 표기: ✅ 현재 코드 / 📝 v2 계획(D-234~D-254, 코드 미반영).
> v2 핵심: **서버 없음. 모든 데이터는 암호화된 로컬 SQLite**. 레이어 규칙(단방향)은 그대로 유지하되 "DB"가 Supabase에서 로컬 DB로 바뀐다.

## 레이어 구조 (v2)

```
┌──────────────────────────────────────────────────────────┐
│  VIEW  (app/ + components/)                              │
│  lock, (tabs)/time·stats·settings, modal/* │
│  components/ui/ (Button, TextField, Toast, AppHeader…)   │
├──────────────────────────────────────────────────────────┤
│  CONTROLLER (store/ + lib/)                              │
│  store/: 기능별 Zustand 스토어 (로컬 DB 호출은 여기서만)    │
│  lib/  : localDb, secure, rates, streak, compound,       │
│          closing, backup, notifications, widgetBridge …  │
├──────────────────────────────────────────────────────────┤
│  MODEL (types/ + constants/ + 로컬 SQLite 스키마)          │
│  types/index.ts, constants/theme·time, db-schema.md      │
└──────────────────────────────────────────────────────────┘
```

## 레이어 참조 방향 (단방향 — 절대 규칙)

```
View → Controller → Model
View  ✗→ DB 직접 호출 (D-001, 로컬 DB에도 동일 적용 — D-234)   // 화면에서 expo-sqlite·SecureStore 직접 import 금지
lib   ✗→ store 직접 import
Model ✗→ Controller/View 참조
```

- SQL은 `lib/localDb.ts`(연결·마이그레이션·쿼리 헬퍼)와 각 store에서만 실행한다. 항상 **파라미터 바인딩**을 쓰고 문자열을 이어 붙여 SQL을 만들지 않는다(D-244).
- 계산 로직(`rates`, `streak`, `compound`, `timeTicker`)은 부수효과 없는 **순수 함수**로 `lib/`에 둔다 — 테스트하기 쉽고 store·화면 어디서나 호출한다.

## 디렉터리 구조

```
Thinketh/
├── app/                      VIEW: Expo Router 화면 (구조·흐름은 navigation.md)
├── components/               VIEW: 재사용 컴포넌트
│   └── ui/                   Button, TextField, Toast, AppHeader, icons  (✅)
├── store/                    CONTROLLER: Zustand
│   ├── useTimeStore.ts       ✅→📝 설정·기록·합계 (로컬 DB로 교체), 기간별 단가 연동
│   ├── useLockStore.ts       📝 잠금 상태, PIN/생체인증 (F-23)
│   ├── useRateStore.ts       📝 시간당 비용 기간 목록·검증 (F-24)
│   ├── useTimerStore.ts      📝 실시간 타이머 (F-27)
│   ├── useStreakStore.ts     📝 스트릭·프리즈·일일 목표 (F-26)
│   ├── useNotifyStore.ts     📝 알림 설정·예약 (F-28)
│   ├── useTagStore.ts        📝 태그 (F-29)
│   ├── useRewardStore.ts     📝 마일스톤·보상 (F-30)
│   └── useReflectionStore.ts 📝 회고 (F-31)
├── lib/                      CONTROLLER: 외부/기기 서비스·순수 계산
│   ├── date.ts               ✅ KST 고정 날짜 유틸 (D-002)
│   ├── timeTicker.ts         ✅ 오늘 버려진 시간 실시간 계산(순수 함수)
│   ├── localDb.ts            📝 SQLCipher 연결, schema_version 마이그레이션 (D-236)
│   ├── secure.ts             📝 DB 키·PIN 해시 (SecureStore) (D-235, D-236)
│   ├── rates.ts              📝 날짜→단가 조회, 기간 검증·수정 가능 여부, 기간별 금액 합산 (D-239, D-250)
│   ├── streak.ts             📝 스트릭·프리즈 계산 (D-242)
│   ├── compound.ts           📝 복리 환산 (D-242)
│   ├── backup.ts             📝 암호화 내보내기/가져오기 (D-237)
│   ├── notifications.ts      📝 로컬 예약 알림 (D-241)
│   ├── widgetBridge.ts       📝 Android 위젯 데이터 전달 (D-243)
│   ├── closing.ts            📝 일 단위 확정 계산 (D-251)
├── types/index.ts            MODEL: 타입 (types.md)
├── constants/                MODEL: theme.ts ✅, time.ts ✅, milestones.ts 📝(배지 단계 상수)
└── docs/

android/                      네이티브 (MVC 밖, git으로 추적 — D-253)
├── 위젯 Kotlin·리소스         📝 (D-243)
└── Ticker*.kt, BootReceiver.kt  ✅ 현재 남아 있음 — 📝 마지막 단계에서 삭제 (D-244)
```

> 훅(`hooks/`)은 사용하지 않는다. 로직은 store와 `lib/` 순수 함수로 둔다.

## 데이터 흐름 (v2)

```
사용자 액션 → View → store 액션
  → lib/localDb (SQLite 쿼리, 파라미터 바인딩) / lib/notifications / lib/widgetBridge
    → store 상태 갱신 (Zustand set) → View 리렌더
기록 저장 시 부수 동작(저장과 분리·독립 실행, D-252): 알림 재예약, 위젯 값 갱신, 마일스톤 검사
앱 시작·복귀·자정 롤오버: 일 단위 확정(D-251) → 지난 날은 확정 값으로 고정(D-250)
```

## 낙관적 업데이트 패턴 (표준)

로컬 DB는 빠르고 실패가 드물어, 쓰기를 먼저 하고 성공하면 상태를 갱신하는 단순 방식을 기본으로 한다. 낙관적 업데이트가 필요한 곳(타이머 정지 직후 화면 등)에서만 기존 패턴(UI 먼저 반영 → 저장 → 실패 시 롤백)을 쓴다. 실패 시 `Alert.alert('저장 실패', …)`.

## 공통 구현 패턴

### 날짜 — KST(UTC+9) 고정

`lib/date.ts`의 `localDateStr()`, `nowKstParts()`, `diffDays()`, `shiftDateStr()`, `kstMsSinceMidnight()`, `hhmmToMs()`만 사용한다(D-002). 로컬 DB의 모든 날짜 컬럼은 `YYYY-MM-DD`(KST) 문자열이다. 알림처럼 기기 벽시계에 맞춰야 하는 경우만 KST 시각을 기기 시각으로 변환해 사용한다(D-241).

### 시간·금액 단위

- 시간은 **분(정수)**으로 저장·계산한다. 화면 표시만 시간(소수 2자리)으로 변환한다(D-239).
- 금액(원)은 `분 × 시간당 금액 ÷ 60`을 계산 마지막에 한 번만 반올림한다. 날짜별로 계산해 합산한다.

### 플랫폼 분기

- Android 전용(위젯, 상시 알림 잔재 코드)은 `Platform.OS === 'android'` 분기 필수. iOS 경로에는 포함하지 않는다.
- SQLCipher·알림·위젯은 Expo Go에서 동작하지 않는다 — 개발용 빌드가 필요하다(setup-build.md).
