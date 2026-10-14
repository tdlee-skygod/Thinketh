# 코딩 규칙 & 컨벤션 — Thinketh

## 1. 기본 원칙

- TypeScript strict 모드 사용
- `any` 타입 금지 → `unknown` 또는 명시적 타입
- ES Modules (`import/export`) 사용, `require()` 금지
- 비동기: `async/await` 우선

## 2. 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|------|------|------|
| React 컴포넌트 | PascalCase | `TagChip.tsx` |
| 화면 파일 | camelCase(Expo Router 라우트) | `time.tsx`, `time-log.tsx` |
| 스토어 | camelCase + Store | `useTimeStore.ts` |
| 훅 | (사용하지 않음 — 로직은 store/lib에) | - |
| 유틸/서비스 | camelCase | `notifications.ts` |
| 타입/인터페이스 | PascalCase | `TimeLog`, `RatePeriod` |
| 상수 | UPPER_SNAKE_CASE | `MILESTONE_STEPS` |
| 테마 토큰 | COLORS, FONT, RADIUS, SPACING | `COLORS.primary` |

## 2-1. 테스트 (D-247)

- `lib/`의 순수 함수(`rates`, `closing`, `streak`, `compound`, `timeTicker`, 백업 암호화, 날짜 유틸)는 `lib/__tests__/<파일명>.test.ts`에 `jest` 단위 테스트를 둔다. 화면·스토어는 테스트 대상이 아니다.
- 금액·날짜 계산을 바꿀 때는 먼저 테스트를 추가/수정하고 통과를 확인한다. 실행: `npm test`(스크립트는 단계 0에서 추가).

## 3. 파일 구성 규칙

```typescript
// 1. React/RN import
import React, { useState } from 'react';
import { View, Text } from 'react-native';

// 2. 서드파티
import { useRouter } from 'expo-router';

// 3. 내부 절대 경로
import { useTimeStore } from '@/store/useTimeStore';
import { COLORS } from '@/constants/theme';

// 4. 상대 경로
import { styles } from './styles';

// 5. 타입
import type { TimeLog } from '@/types';
```

## 4. 스타일 규칙

```typescript
// ✅ 항상 StyleSheet.create() 사용 (파일 하단)
// ✅ 토큰 사용: COLORS.primary, FONT.size.md, RADIUS.md, SPACING.md
// ❌ 색상 하드코딩: '#5b21b6', 'purple'
// ❌ 매직 넘버: padding: 16 → padding: SPACING.md
```

## 5. 에러 처리

```typescript
try {
  const result = await someAsyncOperation();
  if (!result) throw new Error('결과 없음');
  // 성공 처리
} catch (e) {
  console.error('[FunctionName]', e);
  Alert.alert('오류', '처리 중 오류가 발생했습니다.');
}
```

## 6. 커밋 메시지 컨벤션

```
[type]: [간결한 설명] (#F-번호 또는 이슈번호)

type: feat | fix | refactor | style | test | docs | chore | perf
예: feat: 기간별 시간당 비용 저장 시 빈 날 검증 (F-24)
    fix: 자정을 넘기는 타이머 기록 분할 오류 수정 (F-27)
```

## 7. 브랜치 전략

```
main                      ← 안정 브랜치 (직접 push 금지)
  └── v{버전}-{시작일}      ← 작업 브랜치. 예: v2.0.0-20261014 (D-254)
```

- 원격 저장소는 공개(Public)다(D-254). **push 전에** `.env`, 키스토어·`keystore.properties`, 개인 이미지, 비밀값·개인정보가 포함되지 않았는지 확인한다.
- 이 저장소의 커밋 이메일은 GitHub noreply 주소를 쓴다(로컬 `git config`만 설정, 전역 설정은 건드리지 않는다).
- `android/`는 git으로 추적한다(D-253). `build/`, `.gradle/`, `*.keystore`, `keystore.properties`는 제외된다.

## 8. PR 체크리스트

- [ ] 관련 테스트 실행 확인 (`lib/` 순수 함수 변경 시 필수, D-247)
- [ ] 린트/타입 에러 없음
- [ ] UI 변경 시 스크린샷 첨부
- [ ] `.env` 등 민감 파일 미포함
- [ ] 관련 docs/ 문서 업데이트

## 9. 금지 사항 요약

| 금지 항목 | 이유 |
|---|---|
| `.env`, `*.keystore`, `keystore.properties`, `google-services.json` 커밋 | 보안 (공개 저장소, D-254) |
| API 키·토큰 코드 하드코딩 | 보안 |
| `main` 브랜치 직접 push | 안정성 |
| View에서 DB 직접 호출(로컬 SQLite·SecureStore 포함) | 아키텍처 원칙 (D-001, D-234) — store/lib만 호출 |
| 색상·간격 하드코딩 | 디자인 시스템 일관성 (D-003) |
| `new Date().toISOString().slice(0,10)` 또는 `getFullYear()/getMonth()/getDate()` 직접 사용 | UTC/기기 타임존 불일치 — `lib/date.ts`의 `localDateStr()`(KST 고정)만 사용 (D-002) |
| `any` 타입 | 타입 안전성 |
| Android에서 `KeyboardAvoidingView` `behavior`를 `undefined`로 방치 | D-102 — `adjustResize`만으로는 edge-to-edge와 충돌해 키보드가 입력란을 가림 |
| `Link asChild`(expo-router) 자식에 배열 스타일(`style={[a, b]}`) 전달 | D-103 — `flexDirection` 등이 무시되는 레이아웃 버그 발생, 단일 객체로 합쳐서 전달 |
| "하루 알림 횟수" 개념을 UI에 추가, 서버 푸시, Android 상시 알림(포그라운드 서비스) 도입 | D-241 — 알림은 사용자가 항목별로 켜는 **로컬 예약 알림**만 허용(기본 꺼짐) |
| 알림 본문에 금액·민감 정보 포함 | D-241, D-244 — 잠금 화면 노출 방지, 일반 문구만 |
| iOS 코드 경로에 Android 전용 로직(위젯 등) 실행 | 반드시 `Platform.OS === 'android'` 분기 (D-243) |
| SQL을 문자열 연결로 작성 | D-244 — 항상 파라미터 바인딩 |
| PIN·DB 키·백업 비밀번호를 로그·화면·파일에 남김 | D-244 |
| 비밀번호 없는(평문) 백업 파일 생성 | D-237 — 암호화 필수 |
| 시간 단위에 소수 시간(float) 저장 | D-239 — 분(정수)로 저장, 표시할 때만 시간으로 변환 |
| 시간당 비용 기간 사이에 빈 날이 생기도록 저장 | D-239 — 저장 전 검증 |
| 받은 마일스톤 배지의 `achieved_at` 삭제·초기화 | D-242 — 영구 배지 |
| 오늘 이전 날짜의 시간 기록·회고·확정 값(`day_closings`)·`day_settings` 행 수정·삭제·재계산, 지난 날짜를 포함한 기간의 단가·시작일 변경 | D-250, D-251 — 판정은 `lib/`의 수정 가능 여부 함수로만, 날짜 비교 기준 |
| 기록 저장 트랜잭션 안에서 알림·위젯·마일스톤·스트릭 처리 | D-252 — 저장과 후속 처리는 분리하고 서로 독립 실행 |
| DB 열기 실패 시 DB 파일 자동 삭제 | D-253 — 이름만 바꿔 보존, 새로 시작은 사용자 입력 확인 후 |
| 이 앱과 무관한 외부 서비스의 DB 구조·내부 식별자를 문서·코드에 기록 | D-254 — 공개 저장소 |
| Supabase 코드·의존성 사용 | D-234, D-238 — 서버 없음, 기존 데이터도 이전하지 않음 |
