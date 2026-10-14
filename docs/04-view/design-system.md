# 디자인 시스템 — Thinketh

> v2(2026.10.14): 새 화면(통계, 잠금, 마일스톤)도 아래 토큰만 사용한다 — 새 색을 추가하지 않는다(D-003). 위젯은 `primaryDark → primary` 그라디언트와 FND 숫자를 쓴다(D-243).

> 기준: `constants/theme.ts`의 토큰. 신규 화면은 기존 Time 탭의 톤을 따른다.

## 컬러 토큰 (`constants/theme.ts` → `COLORS`)

| 토큰 | HEX | 용도 |
|---|---|---|
| `COLORS.primaryDark` | `#1e1b4b` | 헤더/그라디언트 시작, 다크 요소 |
| `COLORS.primary` | `#5b21b6` | 메인 브랜드 컬러, 버튼, 활성 상태 |
| `COLORS.primaryLight` | `#7c3aed` | 그라디언트, 강조 |
| `COLORS.accentLavender` | `#a78bfa` | 서브 텍스트, 아이콘 |
| `COLORS.accentLavenderLight` | `#c4b5fd` | 다크 배경 위 보조 텍스트 |
| `COLORS.border` | `#ddd6fe` | 카드/입력 테두리(진한 편) |
| `COLORS.borderLight` | `#ede9ff` | 카드 테두리(연한 편) |
| `COLORS.bgLight` | `#f5f0ff` | 화면/카드 배경 |
| `COLORS.bgLighter` | `#faf8ff` | 리스트/통계 화면 배경 |
| `COLORS.gold` | `#fbbf24` | 스트릭·마일스톤 배지 강조 컬러 |
| `COLORS.textDark` | `#1e1b4b` | 본문 진한 텍스트 |
| `COLORS.textMuted` | `#888` / `#bbb` / `#ccc` | 보조/placeholder 텍스트 |

태그 색상은 사용자가 지정한 HEX를 그대로 사용한다(F-29, 고정 팔레트 아님 — `tags.color`).

## 타이포

- 시스템 폰트(-apple-system) 기반, Pretendard 대체 폰트 등록 권장
- 본문 14~18px, font-weight 600~700. 한글 줄바꿈을 고려한다
- 라벨/캡션: 10~11px, letter-spacing 넓게, uppercase(영문 섹션 라벨)

## 형태 토큰 (`RADIUS`, `SPACING`)

- `RADIUS.sm` 8px / `RADIUS.md` 14px / `RADIUS.lg` 20px / `RADIUS.xl` 24px / `RADIUS.pill` 20px(칩/버튼)
- 카드 보더: 1~1.5px, `COLORS.borderLight`
- 그림자: `shadowColor: COLORS.primary`, opacity 0.05~0.15, 은은하게
- `SPACING`: 4 / 8 / 12 / 14 / 16 / 20 / 24 (px, 4배수 기준)

## 아이콘

- outline 스타일 SVG, stroke-width 2~2.5, `stroke-linecap: round`
- 활성 탭 아이콘은 `COLORS.primary`로 채움, 비활성은 opacity 0.3

## 컴포넌트 톤

- 그라디언트 배경(Time 탭 진행바, 마일스톤 카드, 위젯): `linear-gradient(135deg, #5b21b6, #7c3aed)` 또는 `linear-gradient(160deg, #1e1b4b, #4c1d95, #6d28d9)`
- 토글: on 상태 `COLORS.primary` 배경 + 흰 원
- `Button`(`components/ui/Button.tsx`): `size="sm"`을 주면 팝업 하단 액션처럼 좁은 공간에 맞게 세로 패딩·글자 크기를 줄인다 (기본값은 `size="md"`, 기존 화면 영향 없음)
- `Toast`(`components/ui/Toast.tsx`): 등록/수정/삭제 성공 시 하단 중앙에 1.8초 노출 후 자동 소멸 — ux-patterns.md § 토스트 참고 (D-228)
- 확정된(지난) 항목은 읽기 전용으로 보이도록 입력·편집 버튼을 숨기고 `COLORS.pastWash` 배경 + 잠금 안내 문구를 쓴다(D-250)

> 색상·간격 하드코딩 금지 — 반드시 `COLORS`/`SPACING`/`RADIUS`/`FONT` 토큰만 사용 (D-003).

## Time 탭 항목별 색상 (F-21, D-229)

캡처 리뷰 후 모든 숫자가 같은 보라색이라 "버려진 것"과 "나의 것"이 구분되지 않던 문제를 색으로 고정해 해결했다 — 항목의 역할(남은/오늘-버려진/오늘-나의 것/지난)마다 색을 고정하고, 숫자마다 카드 전체 폭을 내어주는 한 줄 리스트로 바꿔 큰 금액이 잘리지 않게 했다.

| 토큰 | HEX | 용도 |
|---|---|---|
| `COLORS.waste` | `#c8402f` | "버려진" 시간/금액 — 경고색 |
| `COLORS.wasteWash` | `#fbe6e2` | waste 배경 틴트(필요 시) |
| `COLORS.mine` | `#178a5c` | "나의 것"(의미있게 쓴) 시간/금액 |
| `COLORS.mineWash` | `#e1f5ec` | mine 배경 틴트, 연필 편집 버튼 배경 |
| `COLORS.pastWash` | `#efedf9` | "지난"(누적 기록) 카드 배경 — 조용한 톤으로 참고용 데이터임을 표시 |

`남은`(진행 중) 항목은 기존 `COLORS.primary`/`primaryDark`를 그대로 쓴다 — 새 색을 추가하지 않는다. `app/(tabs)/time.tsx`는 남은(보라, 진행바 포함)·오늘(흰 카드, 그림자로 들어올림, 버려진=빨강/나의 것=초록 행)·지난(무채 배경, 작은 글자) 3개 카드로 구분되고, 각 통계 행은 라벨(좌)·큰 숫자(우측 정렬, FND 폰트)로 카드 전체 폭을 쓴다.

## FND(7세그먼트) 폰트 — Time 탭 전용 (F-21, D-229)

- `FONT.familyFND.regular`(`DSEG7Classic-Regular`) / `FONT.familyFND.bold`(`DSEG7Classic-Bold`) — `assets/fonts/`에 포함된 오픈소스 폰트(SIL OFL, `DSEG-LICENSE.txt` 참고), `app/_layout.tsx`에서 `expo-font`의 `useFonts`로 로드한다.
- `app/(tabs)/time.tsx`의 라벨·숫자·단위 텍스트에만 적용한다(다른 화면에는 사용하지 않음). 한글 글자는 이 폰트에 없는 글리프라 OS가 자동으로 시스템 폰트로 대체해 표시한다 — 숫자만 디지털 시계 느낌으로 보이고 한글은 평소와 같다.
- 굵기는 `fontWeight`가 아니라 `familyFND.regular`/`familyFND.bold` 중 어떤 패밀리를 쓰는지로 구분한다(커스텀 TTF는 `fontWeight` 스타일링이 무시될 수 있음).

## v2 신규 화면의 색 사용 규칙 📝

- 금액: 나의 것 `COLORS.mine`, 버려진 `COLORS.waste`, 오늘의 손익은 부호에 따라 mine/waste 중 하나.
- 스트릭·배지: `COLORS.gold`. 프리즈로 이어진 날은 `COLORS.accentLavender` 계열로 구분한다(새 색 추가 금지).
- 통계 그래프(도넛·막대): 태그 색 + `COLORS.primary` 계열. 텍스트 대비를 유지한다.
- 잠금 화면: 배경 `COLORS.primaryDark`, 키패드 버튼은 `COLORS.bgLight` 위 `COLORS.textDark`.
- 숫자 표기는 Time 탭과 같이 FND 폰트를 쓰고, 통계 탭은 가독성을 위해 일반 폰트를 기본으로 한다.
