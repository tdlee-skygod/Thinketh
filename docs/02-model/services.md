# 외부·기기 서비스 — Thinketh

> v2(D-234): 외부 서버를 쓰지 않는다. 아래는 기기 안의 서비스 모듈이며 `lib/`에 둔다. 표기: 📝 계획(코드 미반영).
> 레이어 규칙: `lib/`는 store를 import하지 않는다. 화면은 이 모듈을 직접 부르지 않고 store를 거친다(D-001).

## 로컬 DB (`lib/localDb.ts`) 📝

- `expo-sqlite`를 SQLCipher 옵션으로 연다(D-236). 키는 문자열 암호가 아니라 **raw 키**(`PRAGMA key = "x'<hex>'"`)로 지정해 키 유도 지연을 없앤다. 앱 시작 시 `openDb()`가 SecureStore에서 키를 읽어 `PRAGMA key`로 연 뒤 `schema_version`을 보고 순차 마이그레이션을 실행한다.
- 열기 직후 `schema_version`이 앱이 아는 최대 버전보다 크면 DB를 더 열지 않고 "앱을 업데이트해 주세요"를 안내한다(다운그레이드 가드, D-236).
- 모든 쿼리는 파라미터 바인딩(`?`)을 쓴다. 여러 쓰기는 `withTransaction()`으로 묶는다.
- `openDb()`는 `DbOpenResult`(types.md)를 반환한다. 열 수 없으면 PIN 확인 **뒤에** 원인별 안내 화면을 보여 준다(D-253): 새 버전 DB는 "앱을 업데이트해 주세요"(닫기만), 키 분실·손상은 "백업 파일에서 가져오기" 또는 "새로 시작"(직접 "삭제" 입력), 일시적 오류는 재시도. **자동으로 DB를 지우지 않으며**, 새로 시작·백업 가져오기 때 기존 파일은 `thinketh.db.bak-날짜`로 이름만 바꿔 보존한다.

## 일 단위 확정 (`lib/closing.ts`) 📝

- 순수 함수 `buildClosing(date, logs, daySettings, ratePeriods)`가 그날의 `DayClosing`을 만든다(logic.md § 10). 입력이 같으면 언제 실행해도 결과가 같다.
- 실행은 `useTimeStore.closePastDays()`가 앱 시작·포그라운드 복귀·자정 롤오버 때 호출하고, 확정 행이 없는 지난 날짜를 오래된 순으로 모두 저장한다(D-251). 정시 백그라운드 실행은 쓰지 않는다.

## 보안 저장소 (`lib/secure.ts`) 📝

| 키 | 내용 |
|---|---|
| `db_key` | 첫 실행 때 `expo-crypto`로 만든 무작위 256비트 값(hex). 외부로 내보내지 않는다 |
| `pin_hash`, `pin_salt` | 6자리 PIN의 해시와 솔트. 평문 PIN은 저장하지 않는다(D-235) |
| `pin_fail_count`, `pin_lock_until` | 연속 실패 횟수와 대기 종료 시각 |
| `biometric_enabled` | 생체인증 사용 여부 |

- 생체인증과 PIN 재설정(기기 잠금 인증)은 `expo-local-authentication`을 쓴다.
- 이 값들은 로그·화면·백업 파일에 절대 포함하지 않는다(D-244).
- 화면 가림은 `expo-screen-capture`로 잠금 중·백그라운드일 때만 적용한다(D-235).

## 알림 (`lib/notifications.ts`) 📝

> 로컬 예약 알림만 쓴다(D-241). 서버 푸시·Android 상시 알림(포그라운드 서비스)은 쓰지 않는다.

- `ensureNotificationPermission()`: Android 13+ `POST_NOTIFICATIONS`를 첫 사용 시 요청. 거부하면 알림만 비활성이고 나머지 기능은 정상.
- `rescheduleAll(prefs, todayState)`: 앱이 열릴 때와 기록을 저장할 때마다 호출. 기존 예약을 모두 취소하고 **다음 7일 분**을 다시 예약한다(앱을 며칠 열지 않아도 이어짐). 오늘 일일 목표를 이미 달성했으면 오늘의 손실 알림만 뺀다.
- 알림 시각은 KST로 저장하고 예약 시 기기 시각으로 변환한다. 본문은 일반 문구이며 금액을 넣지 않는다.
- 알림을 누르면 종류에 따라 Time 탭 / 회고 시트 / 마일스톤 화면으로 이동한다(잠금 상태면 lock을 먼저 거침).

## 백업 (`lib/backup.ts`) 📝

- `exportBackup(password)`: DB를 `BackupPayload`(types.md)로 직렬화 → `@noble/hashes` scrypt로 비밀번호에서 키 유도 → `@noble/ciphers` XChaCha20-Poly1305로 암호화 → 형식/버전 헤더를 붙인 파일로 저장 후 공유 시트(`expo-sharing`). 비밀번호 없이는 내보낼 수 없다(D-237).
- `importBackup(file, password, mode)`: 파일 크기·헤더·버전 확인 → 복호화(실패·변조 시 거부) → 스키마 검증 → 하나의 트랜잭션으로 `overwrite` 또는 `merge` 반영.
  - `overwrite`: 확인 후 전체 교체.
  - `merge`(D-253): `rate_periods`·`day_settings`는 통째 교체, 나머지는 id(또는 date) 기준 병합하고 `updated_at`이 최신인 쪽 채택. **이미 확정된 날짜의 로컬 기록·회고는 덮어쓰지 않는다.**
  - 반영 뒤 일 단위 확정 → 알림 재예약 → 위젯 갱신 → 마일스톤 검사를 각각 독립적으로 실행한다(D-252).
- 비밀번호·평문 페이로드는 로그에 남기지 않는다.

## 위젯 연동 (`lib/widgetBridge.ts`) 📝 (Android 전용, D-243)

- 기록 저장·설정 변경 때 오늘 나의 금액, 스트릭, 목표 달성률, 금액 표시 여부를 SharedPreferences(앱 전용 모드)에 써서 위젯이 읽게 한다. `widget_show_amount`가 꺼져 있으면 금액을 쓰지 않는다.
- 위젯의 "시작" 버튼은 `thinketh://timer` 딥링크로 앱을 열기만 한다.
- `Platform.OS !== 'android'`면 아무 것도 하지 않는다.
- 값에는 **날짜 스탬프**(KST `YYYY-MM-DD`)를 함께 쓴다. 위젯은 스탬프가 오늘이 아니면 금액·진행률 대신 "—"를 표시한다(D-243).

## 삭제 예정 (✅ 현재 코드)

- `lib/supabase.ts`, `useAuthStore`, `(auth)` 화면, `.env`의 Supabase 키: **단계 0에서 삭제**(D-238).
- 네이티브 `Ticker*.kt`/`BootReceiver.kt`: 마지막 단계(9)에서 삭제(D-244).
