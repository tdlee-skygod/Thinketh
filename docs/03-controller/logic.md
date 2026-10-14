# 핵심 비즈니스 로직 — Thinketh

> 표기: ✅ 현재 코드 / 📝 v2 계획(코드 미반영).
> 모든 계산은 `lib/`의 순수 함수로 구현하고 입력은 `dailyMinutes`(날짜→분), `rate_periods`, `day_settings`(날짜별 적용값), `day_closings`(지난 날 확정 값)다. 날짜는 KST 고정(D-002). **지난 날짜는 재계산하지 않고 확정 값을 쓴다**(D-250, D-251).

## 1. 기간별 단가 (F-24, D-239) 📝 — `lib/rates.ts`

```
rateOn(date)   = date가 속한 rate_period의 hourly_rate, 없으면 0 (첫 기간 이전 날짜 등)
moneyOf(date, minutes) = round(minutes × rateOn(date) / 60)     // 마지막에 한 번만 반올림

검증(validatePeriods):
  1. 시작일 ≤ 종료일
  2. 기간끼리 겹치지 않음
  3. 정렬했을 때 이전 종료일 + 1일 = 다음 시작일 (빈 날 없음) — 위반 시 저장 불가, 빈 구간을 날짜로 안내
수정 가능 여부(checkPeriodEdit, D-250): 시작일이 오늘보다 이전인 기간은 단가·시작일 변경과 삭제 불가(reason='past_period'). 종료일은 새 값이 오늘 이상일 때만 변경 가능. 시작일이 오늘 이후인 기간은 자유롭게 수정·삭제. 새 단가가 필요하면 현재 기간의 종료일을 오늘로 줄이고 내일부터 시작하는 기간을 추가한다. 과거는 재계산되지 않으므로 "과거 금액이 다시 계산됩니다" 확인 안내는 없다.
자동 조정(autoAdjustAfterEdit):
  기간의 종료일을 바꾸면 다음 기간의 시작일 = 새 종료일 + 1일로 맞춘다.
  다음 기간이 사라질 만큼 종료일을 늘리는 경우는 확인 후 허용(삼켜진 기간은 삭제).
삭제: 중간 기간은 이웃 기간(이전의 종료일을 늘리거나 다음의 시작일을 당김)으로 메우는 경우에만 허용.
전체 기간: 시작 = 첫 기간 시작일, 끝 = 마지막 기간 종료일.
```

## 2. Time 탭 계산 (F-21) 📝 — 날짜별 단가 적용

```
dsToday = daySettingsOn(today)                 // effective_from ≤ today 중 가장 늦은 행 (D-250)
availableMinutes(d) = daySettingsOn(d).available_hours_per_day × 60
today = localDateStr()

오늘 나의 시간(분) = dailyMinutes[today] (+ 진행 중 타이머 경과 분, 로직 3)
오늘 나의 금액     = moneyOf(today, 오늘 나의 시간)
오늘 버려진 시간   = computeLiveWastedHours(...)    // 로직 4, 타이머 경과를 나의 시간에 포함
오늘 버려진 금액   = 버려진 분 × rateOn(today) / 60

남은 일수 = 마지막 기간 종료일 − today
남은 금액 = Σ (오늘 이후 ~ 종료일의 각 날짜 d) availableMinutes(d) × rateOn(d) / 60
            // 미래 날짜는 현재 설정으로 예상(내일 시작 행이 있으면 그 값)

지난 일수         = today − 첫 기간 시작일 (오늘 제외)
지난 나의 금액    = Σ day_closings.my_amount        (시작일 ~ 어제, 확정 값)
지난 버려진 금액  = Σ day_closings.wasted_amount     (확정 값, 재계산하지 않음)

오늘의 손익 = 오늘 나의 금액 − 오늘 버려진 금액   (F-28)
```

- 확정 행이 아직 없는 지난 날짜가 있으면(앱을 오래 열지 않음) 화면을 그리기 전에 로직 10으로 먼저 확정한다.
- 마지막 기간이 지났으면(today > 종료일) 남은 일수·금액은 0으로 두고 "새 기간을 추가해주세요"를 안내한다. 첫 기간 시작일 이전의 기록은 0원으로 계산한다(D-239).
- 파생값은 스토어에 저장하지 않고 화면이 그때그때 `lib/rates.ts`로 계산한다. 긴 기간(수백 일)도 단순 합산이라 성능 문제가 없다.

## 3. 타이머 (F-27, D-242) 📝

```
시작: timer(id=1) 행에 started_at = 지금(ISO), tag, title 저장
경과: elapsedMinutes = max(0, (now − started_at) / 60초)  — 앱을 껐다 켜도 같은 계산, 기기 시계를 되돌려도 음수가 되지 않음
정지: 
  0. 지금 시각이 started_at보다 이전이면 저장을 거부하고 안내
  1. 경과 분이 12시간(720분)을 넘으면 사용자 확인
  2. 시작~종료 구간이 KST 자정을 넘으면 날짜별로 나눠 각각 time_logs로 저장
  3. 각 조각이 36초 미만이면 1분으로 올림 (minutes > 0 제약)
  4. 저장 후 timer 행 삭제 → 알림 재예약·위젯 갱신·마일스톤 검사
취소: timer 행만 삭제, 기록 없음
```

타이머 시간은 "나의 시간"으로 간주한다 — 진행 중에는 오늘 나의 시간에 경과 분이 더해져 버려진 시간이 늘지 않는다.

## 4. 오늘 버려진 시간 실시간 계산 (D-231) ✅ `lib/timeTicker.ts`

```
(active_start/end_time, availableHours는 오늘 적용값 daySettingsOn(today))
경과 비율 = clamp((now − active_start_time) / (active_end_time − active_start_time), 0, 1)
가용시간 배분값 = availableHours × 경과 비율
오늘 버려진 시간 = clamp(가용시간 배분값 − 오늘 나의 시간, 0, availableHours)

활동 시작 전 → 0으로 정지 / 활동 종료 후 → 경과 비율 1로 확정
```

활동 시간대 밖에 타이머로 쌓은 시간은 나의 시간에는 더해지지만 버려진 시간은 0 미만으로 내려가지 않는다(clamp). 이 함수는 순수 함수이며 v2에서도 그대로 쓰되 입력 단위만 시간→분 변환해 호출한다.

## 5. 스트릭 · 일일 목표 · 프리즈 (F-26, D-242) 📝 — `lib/streak.ts`

```
달성일: dailyMinutes[d] ≥ daySettingsOn(d).streak_min_minutes (기본 60분, 날짜별 적용값 — D-250)
일일 목표 진행률 = dailyMinutes[today] / daySettingsOn(today).daily_goal_minutes  (막대 표시용, 스트릭과 별개)

연속일 계산 (어제부터 거꾸로):
  - 오늘은 아직 달성하지 않았어도 스트릭을 끊지 않는다 (하루가 끝나야 확정). 오늘 달성하면 +1
  - 달성하지 못한 날을 만나면 그 날이 속한 주(월~일, KST)에 프리즈가 남아 있을 때만 그 날을 "프리즈로 이어짐"으로 처리하고 계속
  - 한 주에 프리즈는 최대 1회. 프리즈가 없으면 거기서 스트릭이 끊긴다
  - 오늘 빠진 기록을 채우면 프리즈 사용은 자동으로 취소된다 (저장하지 않고 매번 재계산하기 때문). 지난 날은 수정할 수 없으므로(D-250) 이미 지난 날의 프리즈 사용은 바뀌지 않는다
best: 전체 기간 중 가장 긴 연속일
```

## 6. 복리 환산 (F-29, D-242) 📝 — `lib/compound.ts`

```
m = 이번 달 나의 금액(날짜별 단가 반영 합계)
r = settings.compound_rate_pct / 100 / 12   (월 이율, 기본 연 5%)
12개월 후 가치 = m × ((1 + r)^12 − 1) / r        (r = 0이면 m × 12)
```

예: 월 180,000원, 연 5% → 약 2,210,000원. "가정 시뮬레이션이며 수익을 보장하지 않습니다"를 화면에 항상 표기한다.

## 7. 마일스톤 (F-30, D-242) 📝

```
누적 나의 금액 = Σ day_closings.my_amount (지난 날 확정 값) + 오늘 나의 금액
단계 = [1,000,000 / 3,000,000 / 5,000,000 / 10,000,000 / 30,000,000 / 100,000,000]  (constants/milestones.ts)
기록 저장 직후: 새로 넘은 단계가 있고 rewards.achieved_at이 비어 있으면 현재 시각 기록 + 축하 화면
한 번 기록된 achieved_at은 취소하지 않는다 — 영구 배지. 지난 날이 고정되어(D-250) 누적 금액은 줄어들지 않지만(오늘 기록 삭제만 예외), 그래도 배지는 유지한다
```

## 8. 알림 (F-28, D-241) 📝

```
항목: loss_am / loss_pm / loss_eve (기본 09:00 / 14:00 / 19:00 KST), reflection(기본 22:30), milestone(목표 금액의 90% 도달 시)
기본값은 모두 꺼짐. 켠 항목만 예약.
재예약 시점: 앱 시작, 기록 저장·수정·삭제, 설정 변경
예약 범위: **다음 7일 분**(항목 5종 × 7일, 약 35건 이내) — 앱을 며칠 열지 않아도 알림이 이어진다. 재예약 때 기존 예약은 모두 취소 후 다시 만든다.
오늘 일일 목표를 이미 달성했으면 오늘의 loss_* 만 예약에서 뺀다(내일 이후 분은 유지)
본문은 일반 문구(금액 미포함). 알림을 누르면 Time 탭 등으로 이동해 정확한 금액을 보여 준다
```

## 9. 앱 잠금 (F-23, D-235) 📝

> 화면 가림: 잠금 중이거나 앱이 백그라운드일 때만 `FLAG_SECURE`를 켜고(`expo-screen-capture`), 잠금 해제 후 포그라운드에서는 해제한다.

```
잠금 조건: 앱 시작 직후 / 백그라운드 진입 후 lock_timeout_sec(기본 30초) 경과 후 복귀
해제: 6자리 PIN(해시 비교) 또는 생체인증. 연속 5회 실패 → 대기 시간 증가(예: 30초, 1분, 5분…)
PIN 분실: 기기 잠금 인증 통과 시 새 PIN 설정(데이터 유지). 기기에 화면 잠금이 없으면 재설정 불가 → 설정 화면에서 미리 안내
```

## 10. 일 단위 확정 (F-34, D-251) 📝 — `lib/closing.ts`

```
대상: today 이전 날짜 중 day_closings 행이 없는 날 (가장 오래된 날부터 순서대로)
실행: 앱 시작 / 포그라운드 복귀 / 앱이 켜진 채 자정을 넘길 때. 정시 백그라운드 실행은 없음

buildClosing(d):
  ds        = daySettingsOn(d)
  available = ds.available_hours_per_day × 60
  my        = dailyMinutes[d]                       // 그날 time_logs 합계
  wasted    = clamp(available − my, 0, available)   // 활동 종료 후 확정 값과 같은 식 (로직 4의 경과 비율 = 1)
  rate      = rateOn(d)                             // 기간이 없으면 0
  my_amount = round(my × rate / 60), wasted_amount = round(wasted × rate / 60)
  → day_closings(d, available, my, wasted, rate, my_amount, wasted_amount, now) 저장 (한 날짜씩 트랜잭션)
```

- 입력이 그날의 `time_logs`·`day_settings`·`rate_periods`뿐이라 나중에 실행해도 결과가 같다(결정적).
- 오늘 이전 날의 기록·기간·설정은 수정할 수 없으므로(로직 11) 확정 값이 원본과 어긋나지 않는다.
- 확정 도중 실패한 날짜는 건너뛰지 않고 다음 실행 때 다시 시도한다. 일부 날짜만 확정돼도 화면은 확정된 날은 확정 값, 안 된 날은 계산 값을 쓴다.

## 11. 수정 가능 여부 판정 (D-250) 📝

```
isEditableDate(d)          = d ≥ today                       // 기록·회고 추가/수정/삭제
checkPeriodEdit(p, change) = 로직 1 참고                      // 시작일 < today 인 기간은 단가·시작일·삭제 불가, 종료일 ≥ today 만
saveDaySettings(patch)     = effective_from = 내일 행을 upsert // 오늘 이하 행은 수정·삭제 불가
```

- 판정은 항상 날짜 비교로 한다. `day_closings`의 유무에 의존하지 않는다(확정이 늦어도 자정이 지나면 즉시 수정 불가).
- store 액션은 저장 전에 이 함수로 검사하고, 거부되면 `EditCheck.reason`을 화면에 넘겨 읽기 전용 안내를 띄운다.

## 12. 기록 저장 뒤 후속 처리 (D-252) 📝

```
saveTimeLog():
  [트랜잭션] 기록 저장        ← 실패하면 전체 실패, Alert.alert('저장 실패')
  성공 → Toast 표시, 이후 독립 실행(서로·저장 결과에 영향 없음, 오류는 로그에 내용 없이 기록):
    스트릭 재계산 / 마일스톤 검사 / 알림 7일 재예약 / 위젯 갱신
앱 시작 점검: 마일스톤 재검사, 알림 재예약, 위젯 갱신, 일 단위 확정(로직 10)
```
