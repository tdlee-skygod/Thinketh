# Changelog — Thinketh

> **어떤 변경이든 여기에 기록한다.**
> 형식: `## 제목 — YYYY.MM.DD` 아래에 추가/수정/삭제/문서/확정 결정을 적는다.
> v1(2026.08.30 ~ 2026.10.12)의 상세 변경 이력은 공개 저장소 정리(2026.10.14) 때 삭제했다. 원본은 로컬 압축 백업에만 있다.

## 형식 가이드

```markdown
## [제목] — YYYY.MM.DD

### 추가 (feat)
- [무엇을 추가했는가]

### 수정 (fix/refactor)
- [무엇을 수정했는가]

### 문서 (docs)
- [어떤 문서를 갱신했는가]

### 확정 결정
- [D-번호] [결정 내용] → decisions.md 참조
```

---

## 단계 1 — 조각 1-B: 내보내기/가져오기 — 2026.10.14

> 코드 변경만 했고 빌드·실기기 확인은 하지 않았다. 단계 1 완료(코드 기준).

### 추가 (feat)
- `lib/backupCrypto.ts`(scrypt N=2¹⁴ + XChaCha20-Poly1305, 헤더 AAD, kdf 비용 상한, 직접 구현한 UTF-8 복호화), `lib/backupPayload.ts`(엄격한 내용 검증, 병합 계획), `lib/backup.ts`(파일·DB·공유), `store/useBackupStore.ts`, `app/modal/backup.tsx`, 설정 탭 "백업" 그룹
- `DbRecovery`에 [백업에서 가져오기]: 파일 복호화·검증 통과 후에만 기존 DB 파일을 보존(이름 변경)하고 새 DB에 반영
- 의존성 `@noble/ciphers`, `expo-sharing`, `expo-document-picker`
- 테스트 `backupCrypto`·`backupPayload` — 전체 68건

### 확정 보완
- 병합은 오늘 이후 기록만 합치고 지난 날짜 기록은 추가·갱신하지 않음. 기간·설정 교체가 지난 값을 바꾸면 거부. 전체 복원은 덮어쓰기 (D-253 보완)

### 확인
- `npm test` 68건 통과, `npx tsc --noEmit` 통과
- 빌드 후 확인할 항목: 파일 공유 시트, 파일 선택기(캐시 복사 경로), scrypt 소요 시간, 복구 화면 가져오기

## 단계 1 — 조각 1-A: 기간별 시간당 비용·지난 날짜 수정 불가 — 2026.10.14

> 코드 변경만 했고 빌드·실기기 확인은 하지 않았다. 단계 1 나머지(1-B: 내보내기/가져오기)는 다음 조각.

### 추가 (feat)
- `lib/rates.ts`(순수 함수): 단가 조회·금액, 기간 검증(겹침·빈 날·역전, 빈 구간 날짜 안내), 자동 조정, 기간 삭제(이웃이 메움), 내일부터 새 단가 분할, 수정 가능 판정(`checkPeriodEdit`·`checkDateEdit`), 날짜별 설정 조회, 지난·남은 금액 합산 — 테스트 26건
- `store/useRateStore.ts`, `app/modal/rate-period.tsx`(기간 추가·수정·삭제·[내일부터 새 단가 적용]), `lib/pickerDate.ts`

### 수정 (refactor)
- `useTimeStore`: 합성 `settings`를 없애고 `daySettings`·`dailyMinutes` 제공. 가용시간·활동 시간대는 기록·기간이 있으면 내일부터 적용(`saveDaySettings`). 기록 수정·삭제는 오늘 것만(D-250)
- `time.tsx`: 날짜별 단가·가용시간으로 남은·지난 금액 계산, 마지막 기간이 끝나면 안내 배너. `time-settings.tsx`: 비용 기간 목록 + 가용시간·활동 시간대. `time-log.tsx`: 지난 날 기록은 읽기 전용("확정됨")

### 확인
- `npm test` 45건 통과, `npx tsc --noEmit` 통과
- 일 단위 확정 저장(`day_closings`)은 단계 2. 그때까지 지난 합계는 날짜별로 계산하며, 지난 입력을 수정할 수 없어 값이 바뀌지 않는다

## 단계 0 — 조각 4: 테스트 환경·INTERNET 권한·마무리 점검 — 2026.10.14

> 단계 0 완료(코드 기준). 빌드·실기기 확인은 하지 않았다.

### 추가 (feat)
- jest 환경(`babel-jest` + `babel-preset-expo`), `npm test`, `lib/__tests__/` 테스트 19건(`date`, `timeTicker`, `pin`) 통과. `jest-expo` 프리셋은 현재 RN 버전과 맞지 않아 사용하지 않음. `tsconfig.json`에 jest 타입 추가
- `android/app/src/release/AndroidManifest.xml`: 릴리즈에서 `INTERNET` 제거(`tools:node="remove"`) — `expo-file-system` 등 라이브러리가 선언한 권한까지 제거

### 수정 (refactor)
- `INTERNET` 권한을 main 매니페스트에서 debug·debugOptimized로 이동 (D-246)
- 문서 상태 표기: D-234·D-235·D-236·D-238·D-240(삭제 부분)·D-246·D-247을 ✅로

### 확인
- `npm test` 19건 통과, `npx tsc --noEmit` 통과, 삭제 대상 코드 참조 0건
- 빌드 때 확인할 항목: 릴리즈 병합 매니페스트에 `INTERNET`이 없는지, SQLCipher 열기·마이그레이션, PIN 해제 속도, 백그라운드 화면 가림, 생체인증, DB 복구 화면

### 단계 0 요약
- 조각 1 목표·음성 제거 → 조각 2 로컬 DB·Supabase 삭제 → 조각 3 앱 잠금·복구 화면 → 조각 4 테스트·권한

## 단계 0 — 조각 3: 앱 잠금·시작 순서·DB 복구 화면 — 2026.10.14

> 코드 변경만 했고 빌드·실기기 확인은 하지 않았다. 빌드 후 확인할 항목: PIN scrypt 해제 속도, 백그라운드 진입 시 화면 가림 타이밍(최근 앱 미리보기), 생체인증, DB 복구 화면.

### 추가 (feat)
- `lib/pin.ts`(scrypt PIN 해시·검증, 실패 대기 시간), `lib/secure.ts` 확장(PIN·실패 상태·생체인증·자동 잠금 시간), `store/useLockStore.ts`
- `components/lock/`(PinPad, PinSetupScreen, LockScreen, TextLink), `components/DbRecovery.tsx`, `app/modal/pin-change.tsx`
- `lib/localDb.ts`의 `archiveDbFiles()`: 열 수 없는 DB 파일을 지우지 않고 `thinketh.db.bak-날짜`로 이름만 변경
- 의존성 `expo-local-authentication`, `expo-screen-capture`, `expo-file-system`, `@noble/hashes`

### 수정 (refactor)
- `app/_layout.tsx`: 시작 순서(폰트·잠금 상태 → PIN 설정/잠금 화면 → DB 열기 → 복구 화면 또는 앱), `AppState`로 백그라운드 재잠금, 잠금·백그라운드 때만 `expo-screen-capture`로 화면 가림
- `settings.tsx`: "앱 잠금" 그룹(PIN 변경, 생체인증, 자동 잠금 시간, 기기 잠금 없음 안내)

### 문서 (docs)
- 자동 잠금 시간은 DB가 아니라 SecureStore(DB 열기 전에 필요), 잠금·복구 화면은 라우트가 아닌 컴포넌트, 복구 화면의 백업 가져오기는 단계 1로 보류 — db-schema·types·stores·navigation·services·setup-build 반영

### 확인
- `npx tsc --noEmit` 통과

## 단계 0 — 조각 2: 로컬 DB 신설·Supabase 삭제 — 2026.10.14

> 코드 변경만 했고 빌드·실기기 확인은 하지 않았다(새 네이티브 모듈이 있어 개발용 빌드가 필요). 네이티브 반영은 빌드 때 `npx expo prebuild`(`--clean` 없이) 후 `git diff`로 검토한다.

### 추가 (feat)
- `lib/localDb.ts`: SQLCipher raw 키 DB 열기, 순차 마이그레이션(v1), 새 버전 DB 가드, 파라미터 바인딩 헬퍼, 직렬 트랜잭션. 열기 실패 시 파일을 지우지 않고 `DbOpenResult` 반환
- `lib/secure.ts`: 무작위 256비트 DB 키 생성·조회(SecureStore)
- 의존성 `expo-sqlite`, `expo-secure-store`, `expo-crypto`, `app.json` 플러그인, `android/gradle.properties`의 `expo.sqlite.useSQLCipher=true`

### 수정 (refactor)
- `store/useTimeStore.ts`를 로컬 DB 기반으로 재작성(같은 화면 인터페이스, 시간은 분 단위 저장). 비용 기간·`day_settings`를 나눠 저장하되 단계 0은 임시로 기간 1개·최초 행 덮어쓰기
- `app/_layout.tsx`: 폰트 로딩 + DB 열기, 실패 시 안내 문구(복구 화면은 조각 3). `(tabs)/_layout.tsx`·`settings.tsx`: 로그인·프로필 카드·로그아웃 제거
- `time.tsx`, `time-log.tsx`: 분↔시간 변환만. `types/index.ts`: `userId`·`Profile` 제거, `TimeLog.minutes`, `RatePeriod`·`DaySettings`·`DbOpenResult` 추가
- `AndroidManifest.xml`: `allowBackup="false"` (D-236)

### 삭제 (remove)
- `lib/supabase.ts`, `store/useAuthStore.ts`, `app/(auth)/` 3개, `.env`·`.env.example`, 의존성 `@supabase/supabase-js`·`@react-native-async-storage/async-storage`

### 확인
- `npx tsc --noEmit` 통과

## 단계 0 — 조각 1: 목표 탭·음성 입력 제거 — 2026.10.14

> 단계 0은 4개 조각으로 진행한다: ① 목표·음성 제거(이번) ② 로컬 DB·`useTimeStore` 교체 + Supabase·로그인 삭제 ③ 앱 잠금·시작 순서·DB 복구 화면 ④ 설정 정리·점검. `useTimeStore`가 Supabase·`useAuthStore`에 묶여 있어 Supabase·로그인 삭제는 ②에서 함께 한다.

### 삭제 (remove)
- 목표 탭 `app/(tabs)/goals.tsx`, `components/goal/*`(3개), `store/useGoal*Store`(4개), `store/useVoiceFocusStore.ts`
- `types/index.ts`의 목표 관련 타입 4개, `components/ui/icons.tsx`의 `MicIcon`·`TargetIcon`·`BellIcon`
- 의존성 `expo-speech`, `expo-speech-recognition`, `app.json`의 음성 인식 플러그인
- `(tabs)/_layout.tsx`의 목표 탭 항목 — 탭은 Time/설정 2개(통계 탭은 단계 2)

### 확인
- `npx tsc --noEmit` 통과. 빌드·실기기 확인은 하지 않음
- `AndroidManifest.xml`의 `RECORD_AUDIO`·음성 인식 `<queries>`는 단계 9에서 삭제(D-244)

### 확정 결정
- D-240 중 목표 탭·음성 입력 제거 부분 ✅ 반영

## 공개 저장소 준비·설계 보완 확정 — 2026.10.14

> **앱 코드는 아직 변경하지 않았다.** 문서와 저장소 구성만 정리했다.

### 확정 결정 (decisions.md D-250 ~ D-254)
- 지난 날짜의 기록·회고·설정은 수정 불가, **당일만 수정 가능**. 지난 날짜를 포함한 비용 기간의 단가·시작일은 변경·삭제 불가. 가용시간·활동 시간대·일일 목표·스트릭 기준은 다음 날부터 적용 (D-250, D-239 개정)
- 하루가 지나면 그날을 확정(스냅샷) — 앱 시작·복귀·자정 롤오버 때 실행, 정시 백그라운드 실행은 쓰지 않음 (D-251)
- 기록 저장은 트랜잭션 하나, 스트릭·마일스톤·알림·위젯은 저장과 분리해 독립 실행 (D-252)
- `android/`를 git으로 추적, 백업 병합 규칙(기간·날짜별 설정은 통째 교체, 확정된 날짜는 덮어쓰지 않음), DB 열기 실패 흐름(자동 삭제 없음, 파일 보존) (D-253)
- 공개 저장소 운영: 원격 `https://github.com/tdlee-skygod/Thinketh`(Public), 작업 브랜치 `v2.0.0-20261014`, noreply 커밋 이메일 (D-254)
- 서명 키스토어는 v2에서 변경하지 않음 (D-223)

### 삭제
- 프로젝트 루트: `PRD.md`, `thinketh_mockup.html`, 중복 문서 6개, 템플릿 문서 5개(`FIX-ISSUE`, `HOW_TO_USE`, `NEW-FEATURE`, `RELEASE`, `security-reviewer`)
- `ref/`, `.claude/`, `supabase/`(스키마 SQL 포함)
- 문서에서 폐기된 v1 기능·Supabase 구조·외부 서비스 식별자 서술

### 수정
- `.gitignore`: `/android` 전체 제외를 풀고 빌드 산출물·키스토어만 제외, `.claude/`·`ref/` 제외 추가

### 문서 (docs)
- decisions(폐기 결정 삭제·D-250~D-254 추가), requirements(F-34 추가·폐기 표 삭제), db-schema(`day_settings`·`day_closings` 추가), types, services, stores, logic(§ 10~12 추가), navigation, architecture-mvc, ux-patterns, design-system, conventions(브랜치·공개 저장소 규칙), setup-build, product-vision, CLAUDE.md 갱신

## v2 전환 계획 확정 (로컬 전용 + 동기 강화) — 2026.10.14

> **코드는 아직 변경하지 않았다.** 아래는 개발자와 합의한 계획이며, 단계별로 구현하면서 각 단계마다 이 문서에 구현 완료를 기록한다.

### 확정 결정 (decisions.md D-233 ~ D-249)
- 서버 폐기, 모든 기능을 기기 안에서만 구현 (D-234). 로그인은 앱 잠금(6자리 PIN, 생체인증 선택)으로 대체 (D-235)
- 로컬 DB는 SQLCipher 암호화 + 키는 SecureStore, 자동 백업 끔 (D-236). 백업은 비밀번호 암호화 필수의 내보내기/가져오기 (D-237)
- 기존 데이터는 **이전하지 않고** 처음부터 누적 관리 (D-238)
- 시간당 비용을 기간별 다중 설정, 기간 사이 빈 날 금지, 날짜별 단가로 금액 계산, 시간은 분(정수) 저장 (D-239)
- 탭은 Time/통계/설정, 목표 탭 삭제·통계 탭 신설 (D-240)
- 알림 재도입: 사용자가 항목별로 켜는 로컬 예약 알림, 기본 꺼짐, 다음 7일 분 예약 (D-241)
- 동기 강화 기능: 스트릭·일일 목표·프리즈, 실시간 타이머, 손실 회피 알림·오늘의 손익, 태그·복리 환산·통계, 마일스톤·보상, 회고·추이 (D-242)
- Android 위젯: 표시 전용, 금액 숨김 기본, 날짜 스탬프 (D-243). 보안 기준 (D-244)
- Time 탭은 스크롤 없는 한 화면 유지, "지난" 카드는 통계 탭 "누적 현황"으로 이동 (D-245)
- 릴리즈 빌드에서 INTERNET 권한 제거 (D-246), `lib/` 순수 함수 jest 테스트 (D-247), 단계마다 변경 목록 확인 (D-248), v2에서 iOS 제외 (D-249)

### 구현 단계
| 단계 | 내용 |
|---|---|
| 0 | 기반 전환: git 준비, SQLCipher DB, 앱 잠금, 서버 코드·로그인 화면 제거, Time 탭 로컬화, 목표 탭 삭제 |
| 1 | 기간별 시간당 비용 + 내보내기/가져오기 + 수정 가능 여부 규칙(D-250) |
| 2 | 스트릭·일일 목표·프리즈 + Time 탭 한 화면 재구성 + 통계 탭 뼈대(누적 현황) + 일 단위 확정(D-251) |
| 3 | 실시간 타이머 |
| 4 | 알림 + 오늘의 손익 |
| 5 | 태그 + 복리 환산 + 통계 탭 나머지 구간 |
| 6 | 마일스톤·보상 |
| 7 | 회고 + 추이 |
| 8 | Android 위젯 |
| 9 | 불필요 권한·네이티브 코드(TickerService 등) 제거 |

## 홈·통계·문구 관련 기능 제거 — 2026.10.13

### 삭제 (remove)
- 홈 탭(오늘의 문구·스트릭·공유)과 통계 탭(구) 제거
- 설정 탭의 문구 선택 방식, Android 상시 알림·알림 시간대, "문구 관리" 그룹 제거
- 문구/카테고리 관리·빠른 등록, 샘플 문구 시드 제거. AppHeader의 "+" 버튼 제거
- 관련 스토어, `lib/notifications.ts`, `lib/seed.ts`, `constants/seedQuotes.ts`, Chip, QuoteListItem 제거
- 탭은 Time/목표/설정 3개, 로그인 후 진입 화면은 Time
- Android 네이티브 코드(TickerService 등)는 유지 (JS 쪽만 정리, 단계 9에서 삭제 예정)

## v1 — 2026.08.30 ~ 2026.10.12

- 이 앱의 초기 구현 기간(Expo SDK 57 기반, Time 탭 구현 포함). 상세 이력은 삭제됨(위 안내 참고).
- Time 탭(F-21)의 설계 근거는 decisions.md D-229~D-231을 따른다.
