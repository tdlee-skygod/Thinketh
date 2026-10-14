# Thinketh — Claude 총괄 허브

> **이 파일의 역할: 총괄 인덱스.**
> 상세 내용은 담지 않는다. 어느 문서를 봐야 하는지만 알려준다.
> 버전: **v2 계획** (2026.10.14) — 로컬 전용 앱으로 전환 중(D-234). 문서의 📝 표기는 계획이며 코드 미반영
> 플랫폼: React Native / Expo (managed workflow)

---

## ⚠️ 행동 지침 (최우선 적용)

@docs/karpathy-guidelines.md

### 공통 지침 (모든 작업에 적용)

1. **빌드(build)는 요청이 있을 때까지 임의로 수행하지 않는다.**
2. **코딩(coding)은 요청이 있을 때까지 임의로 수행하지 않는다.**
3. **질문 답변, 진행사항은 항상 한글로 표기한다.**
4. **v2 구현은 단계(0~9)마다 변경 목록을 먼저 보여주고 확인받은 뒤 진행한다 (D-248).**
5. 불명확한 사항은 가정하지 않고 질문한다.

---

## 0. 코드 작성 전 필수 절차

```
1. 작업 대상 레이어의 문서를 읽는다  →  아래 § 2 라우팅 표
2. docs/06-decisions/decisions.md 의 금지·확정 사항 확인
3. docs/05-environment/conventions.md 의 규칙 준수
```

---

## 1. 문서 구조

```
                    ┌──────────────┐
                    │  CLAUDE.md   │  ← 총괄 인덱스 (이 파일)
                    └──────┬───────┘
                           │
   ┌──────────┬────────────┼────────────┬──────────┬──────────┐
   ▼          ▼            ▼            ▼          ▼          ▼
00-product 01-arch     02-model    03-ctrl    04-view   05-env
  목표·기능   아키텍처     타입·DB      스토어·훅   화면·UI    빌드·규칙

                           ▲          ▲          ▲
                           └────── 06-decisions ─┘
                                  확정 결정·변경 이력
```

---

## 2. 문서 라우팅 — "무엇을 하려는가" → "어디를 볼 것인가"

| 하려는 일 | 문서 |
|---|---|
| 이 앱이 뭔지, 왜 만드는지 알고 싶다 | [product-vision](docs/00-product/product-vision.md) |
| 기능 요구사항 ID를 찾는다 | [requirements](docs/00-product/requirements.md) |
| 새 파일을 어느 폴더에 둘지 모르겠다 | [architecture-mvc](docs/01-architecture/architecture-mvc.md) |
| 화면 이동·탭·모달을 만든다 | [navigation](docs/01-architecture/navigation.md) |
| 로컬 DB 테이블·컬럼을 만진다 | [db-schema](docs/02-model/db-schema.md) |
| TypeScript 타입이 필요하다 | [types](docs/02-model/types.md) |
| 로컬 DB·보안 저장소·알림·백업·위젯 등 기기 서비스 로직을 짠다 | [services](docs/02-model/services.md) |
| 상태를 어디에 둘지 정한다 | [stores](docs/03-controller/stores.md) |
| 기간별 단가·스트릭·타이머·복리·마일스톤 등 비즈니스 로직을 짠다 | [logic](docs/03-controller/logic.md) |
| UI를 만든다 (색·간격·폰트) | [design-system](docs/04-view/design-system.md) |
| 화면 레이아웃을 확인한다 (탭 3개 + 잠금 + 모달) | [navigation](docs/01-architecture/navigation.md) |
| 빈 상태·로딩·토스트를 처리한다 | [ux-patterns](docs/04-view/ux-patterns.md) |
| 패키지 설치·빌드·배포한다 | [setup-build](docs/05-environment/setup-build.md) |
| 코딩 규칙·금지사항을 확인한다 | [conventions](docs/05-environment/conventions.md) |
| "이건 왜 이렇게 됐지?" 를 확인한다 | [decisions](docs/06-decisions/decisions.md) |
| 무엇이 언제 바뀌었는지 본다 | [changelog](docs/06-decisions/changelog.md) |

---

## 3. 전체 문서 목록

```
Thinketh/
├── CLAUDE.md                              ← 총괄 인덱스 (이 파일)
└── docs/
    ├── karpathy-guidelines.md             코딩 행동 4원칙
    ├── 00-product/
    │   ├── product-vision.md              비전 · 사용자 · 핵심 가치
    │   └── requirements.md               기능 요구사항 (v2: F-21, F-23~F-32)
    ├── 01-architecture/
    │   ├── architecture-mvc.md            MVC 레이어 · 데이터 흐름 · 디렉터리
    │   └── navigation.md                 탭 · 모달 · 화면 흐름
    ├── 02-model/
    │   ├── db-schema.md                   로컬 SQLite 스키마 (SQLCipher, 날짜별 확정 포함)
    │   ├── types.md                       TypeScript 전체 타입 정의
    │   └── services.md                   로컬 DB · 보안 저장소 · 알림 · 백업 · 위젯
    ├── 03-controller/
    │   ├── stores.md                      Zustand 스토어 설계
    │   └── logic.md                      기간별 단가 · 스트릭 · 타이머 · 복리 · 마일스톤
    ├── 04-view/
    │   ├── design-system.md              색상 · 타이포 · 컴포넌트 토큰
    │   └── ux-patterns.md               빈 상태 · 로딩 · 토스트 · 입력
    ├── 05-environment/
    │   ├── setup-build.md                의존성 · .env · 빌드 명령 · 배포
    │   └── conventions.md               코딩 규칙 · 금지 사항
    └── 06-decisions/
        ├── decisions.md                  확정 결정 목록
        └── changelog.md                 전체 변경 이력
```

---

## 4. MVC 아키텍처 한눈에

```
┌──────────────────────────────────────────────┐
│  VIEW  (app/, components/)                    │
│  → 화면 렌더링, 사용자 입력 처리만            │
├──────────────────────────────────────────────┤
│  CONTROLLER (store/, lib/)                    │
│  → 상태관리(Zustand), 로컬 DB·알림·백업 호출   │
├──────────────────────────────────────────────┤
│  MODEL (types/, constants/, 로컬 SQLite 스키마)│
│  → 타입 정의, 정적 데이터, DB 스키마          │
└──────────────────────────────────────────────┘

레이어 참조 방향 (단방향 원칙)
  View → Controller → Model
  View ✗→ DB 직접 호출 (원칙, D-001 — 로컬 DB에도 적용, D-234)
  Model ✗→ Controller/View 참조
```

---

## 5. 빌드 명령 (빠른 참조)

```powershell
# Android 릴리즈 APK
cd android
.\gradlew assembleRelease --no-daemon
# 출력: android/app/build/outputs/apk/release/app-release.apk

# 개발 서버 — ✅ 현재(Expo Go). 📝 v2부터는 Expo Go 불가(SQLCipher·알림·위젯) → 개발용 빌드를 설치한 기기에 연결
$env:EXPO_NO_DOCTOR="1"; npx expo start --lan
```

> 상세 빌드·환경 설정 → [setup-build.md](docs/05-environment/setup-build.md)
> **git**: 원격 `https://github.com/tdlee-skygod/Thinketh`(Public). 작업 브랜치 `v2.0.0-20261014`, `main` 직접 push 금지, push 전 비밀값·개인정보 점검 (D-254). `android/`는 git으로 추적한다 (D-253)

---

## 6. 절대 금지 사항 (요약)

> 전체 목록 → [conventions.md § 금지사항](docs/05-environment/conventions.md)

- ❌ `.env` / `google-services.json` / 키스토어 파일 커밋
- ❌ API 키·비밀번호·토큰·PIN·DB 키 코드 하드코딩, 로그·화면·파일에 노출
- ❌ `main`/`master` 브랜치 직접 push
- ❌ View에서 DB 직접 호출 (D-001 — 로컬 SQLite·SecureStore 포함, D-234)
- ❌ 색상·간격 하드코딩 (`COLORS`/`SPACING`/`FONT` 토큰만 사용)
- ❌ Supabase 코드·의존성 사용 (D-234, D-238 — 서버 없음, 기존 데이터도 이전하지 않음)
- ❌ 서버 푸시, "하루 알림 횟수" 개념, Android 상시 알림(포그라운드 서비스) 도입 (D-241: **사용자가 항목별로 켜는 로컬 예약 알림만 허용, 기본 꺼짐, 본문에 금액 금지**)
- ❌ iOS 빌드/코드 경로에 Android 전용 로직(위젯 등) 포함 (플랫폼 분기 필수). v2 범위에서 iOS는 빌드·검증하지 않는다(D-249)
- ❌ 비밀번호 없는(평문) 백업 파일 생성, SQL 문자열 연결, 소수 시간(float) 저장, 시간당 비용 기간 사이 빈 날 저장 (D-237, D-239, D-244)
- ❌ 오늘 이전 날짜의 기록·회고·확정 값·날짜별 설정 수정·재계산, 지난 날짜를 포함한 기간의 단가·시작일 변경 (D-250, D-251)
- ❌ 저장 트랜잭션 안에서 알림·위젯·마일스톤 처리, DB 열기 실패 시 DB 파일 자동 삭제 (D-252, D-253)
- ❌ `.env`·키스토어·`keystore.properties`·개인 이미지(`ref/`)·`.claude/` 를 공개 저장소에 올림 (D-254)

---

## 7. 문서 변경 규칙

| 무엇을 바꾸나 | 반드시 함께 갱신할 문서 |
|---|---|
| 로컬 DB 컬럼 추가/변경 | db-schema · types · services · stores (+ `schema_version` 마이그레이션) |
| 단가·스트릭·타이머·알림 로직 변경 | logic · stores · requirements |
| 화면 구성 변경 | navigation · design-system |
| 확정 결정 사항 | decisions · 영향 문서 전체 · changelog |

**어떤 변경이든 [changelog.md](docs/06-decisions/changelog.md)에 기록한다.**

---

*Thinketh CLAUDE.md v2 계획 — 2026.10.14 (D-250~D-254 반영)*
