# DB 스키마 — Thinketh (로컬 SQLite / SQLCipher)

> v2(D-234·D-236): 앱은 **기기 안의 암호화된 SQLite 하나**만 사용한다. 아래 스키마는 📝 계획이며 코드 미반영이다.

## 공통 규칙

- 날짜 컬럼: `TEXT 'YYYY-MM-DD'` (KST, D-002). 시각 컬럼: `TEXT` ISO 8601 UTC.
- 시간은 **분(INTEGER)**, 금액은 **원(INTEGER)** — 소수 오차를 피한다(D-239).
- 기본키: 앱에서 만든 UUID `TEXT`.
- 계정이 없으므로 `user_id` 컬럼이 없다. 암호화 키(D-236)와 앱 잠금(D-235) 정보는 DB가 아니라 SecureStore에 둔다.
- 스키마 변경은 `schema_version`의 순차 마이그레이션으로만 한다(`lib/localDb.ts`).
- 테이블 이름에 접두사를 쓰지 않는다.
- **지난 날짜의 행은 수정하지 않는다**(D-250). 이 제약은 DB 트리거가 아니라 store·`lib/`의 수정 가능 여부 판정으로 강제한다.

## 테이블 DDL

```sql
-- 스키마 버전
create table schema_version (
  version integer primary key,
  applied_at text not null
);

-- 앱 설정 (1행, id=1 고정) — 과거 계산에 영향이 없는 값만 둔다
create table settings (
  id integer primary key check (id = 1),
  compound_rate_pct real not null default 5.0,       -- 복리 가정 수익률, 연 %(F-29)
  lock_timeout_sec integer not null default 30,      -- 백그라운드 후 재잠금(F-23)
  widget_show_amount integer not null default 0      -- 위젯 금액 표시(F-32)
);

-- 날짜별 적용 설정 (D-250) — 과거 계산에 영향을 주는 값. 날짜 D의 값 = effective_from ≤ D 중 가장 늦은 행
-- 변경하면 내일 날짜(effective_from = 내일)의 행을 upsert한다. 오늘 이전 행은 수정·삭제 불가
create table day_settings (
  effective_from text primary key,                   -- 적용 시작일. 최초 행은 '0001-01-01'
  available_hours_per_day integer not null default 8 check (available_hours_per_day between 1 and 24),
  active_start_time text not null default '06:00',   -- 'HH:MM', 버려진 시간 누적 시작
  active_end_time text not null default '22:00',     -- 'HH:MM', 확정 시각 (> 시작)
  daily_goal_minutes integer not null default 120,   -- 일일 목표(F-26)
  streak_min_minutes integer not null default 60     -- 스트릭 인정 기준(F-26)
);

-- 시간당 비용 기간 (F-24, D-239) — 겹침 금지, 사이 빈 날 금지는 앱 로직(lib/rates.ts)이 저장 전에 검증
-- 시작일이 오늘 이전인 기간은 단가·시작일 변경과 삭제 불가, 종료일은 오늘 이후로만 변경(D-250)
create table rate_periods (
  id text primary key,
  start_date text not null,
  end_date text not null check (end_date >= start_date),
  hourly_rate integer not null check (hourly_rate >= 0)  -- 원/시간
);
create index idx_rate_periods_start on rate_periods(start_date);

-- 태그 (F-29)
create table tags (
  id text primary key,
  name text not null,
  color text not null          -- HEX
);

-- 오늘의 의미있는 일 기록 (F-21, 하루 여러 건). date < 오늘이면 수정·삭제 불가(D-250)
create table time_logs (
  id text primary key,
  date text not null,
  title text not null,
  content text not null default '',
  minutes integer not null check (minutes > 0),
  tag_id text references tags(id) on delete set null,   -- 삭제된 태그는 미분류
  created_at text not null,
  updated_at text not null
);
create index idx_time_logs_date on time_logs(date);

-- 일 단위 확정 (F-34, D-251) — 하루가 지난 날의 스냅샷. 앱 시작·복귀·자정 롤오버 때 오래된 날부터 생성
create table day_closings (
  date text primary key,
  available_minutes integer not null,    -- 그날 가용시간(분)
  my_minutes integer not null,           -- 그날 나의 시간 합계(분)
  wasted_minutes integer not null,       -- 그날 버려진 시간(분)
  hourly_rate integer not null,          -- 그날 적용 단가(원/시간), 기간이 없으면 0
  my_amount integer not null,            -- 원
  wasted_amount integer not null,        -- 원
  closed_at text not null
);

-- 진행 중 타이머 (F-27, 1행, id=1 고정)
create table timer (
  id integer primary key check (id = 1),
  started_at text not null,
  tag_id text,
  title text not null default ''
);

-- 마일스톤 보상 (F-30) — 배지 단계는 constants/milestones.ts, 달성 시 achieved_at 기록
create table rewards (
  threshold integer primary key,   -- 누적 나의 금액(원): 1000000, 3000000, 5000000, …
  reward_text text not null default '',
  achieved_at text                 -- 처음 달성한 시각, 한 번 기록되면 유지(영구 배지)
);

-- 회고 (F-31, 하루 1건). 오늘 것만 수정 가능(D-250)
create table reflections (
  date text primary key,
  content text not null,
  created_at text not null,
  updated_at text not null
);

-- 알림 설정 (F-28, D-241) — 항목별, 기본 꺼짐
create table notify_prefs (
  kind text primary key,           -- 'loss_am' | 'loss_pm' | 'loss_eve' | 'reflection' | 'milestone'
  enabled integer not null default 0,
  time_kst text                    -- 'HH:MM'
);
```

- **프리즈는 저장하지 않는다.** 기록에서 매번 계산한다(D-242).
- 스트릭은 `time_logs`와 그날의 `day_settings`에서 계산한다. 누적 현황(지난 일수·금액)은 `day_closings`를 합산하고, 오늘만 실시간 계산한다. 그 밖의 통계는 `time_logs`와 `rate_periods`에서 계산하며 별도 집계 테이블이 없다.
- 확정된 날(`day_closings` 행이 있는 날)의 `time_logs`·`reflections`는 수정하지 않으므로 스냅샷과 어긋나지 않는다.
- 첫 실행 시 `settings`는 기본값 한 행, `day_settings`는 `effective_from='0001-01-01'` 기본값 한 행이 생성된다. `rate_periods`는 비어 있으며 Time 탭이 "나의 시간을 등록해주세요" 빈 상태로 안내한다.

## 접근·보안

- DB 파일은 SQLCipher로 전체 암호화, 키는 SecureStore(D-236). 앱 데이터 삭제·재설치 시 키가 사라져 복구 불가 → 백업(F-25) 필수 안내.
- 자동 백업은 끈다(`allowBackup=false`). 이전·복원은 내보내기/가져오기뿐.
- 가져오기는 하나의 트랜잭션, 파라미터 바인딩만 사용(D-237). 병합 규칙은 D-253.
