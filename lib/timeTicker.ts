// Time 탭 "오늘 버려진 시간/금액" 실시간 계산 (D-231).
//
// 활동 시간대(활동 시작~활동 종료, 예: 06:00~22:00)에 "하루 가용시간"(availableHours)을
// 균등 배분한 값(경과 비율 × availableHours)에서 "오늘 나의 시간"을 뺀 값을 그때그때 다시 계산한다.
// 매초 재계산하는 순수 함수라 "나의 시간"이 몇 번을 기록되든 그 즉시 정확히 반영되고,
// 활동 종료 시각(경과 비율=1)에는 항상 정확히 availableHours − 오늘 나의 시간으로 수렴하며
// availableHours를 넘지 않는다. 활동 시작 전에는 0으로 정지, 활동 종료 이후에는 그 값으로 확정된다.

export interface LiveWastedResult {
  wastedHours: number;
  started: boolean; // 활동 시작 시각이 지났는가
  finalized: boolean; // 활동 종료 시각이 지나 값이 확정되었는가
}

export function computeLiveWastedHours(params: {
  nowMs: number;
  activeStartMs: number;
  activeEndMs: number;
  availableHours: number;
  todayHours: number;
}): LiveWastedResult {
  const { nowMs, activeStartMs, activeEndMs, availableHours, todayHours } = params;

  if (activeEndMs <= activeStartMs || nowMs <= activeStartMs) {
    return { wastedHours: 0, started: false, finalized: false };
  }

  const finalized = nowMs >= activeEndMs;
  const clampedNow = Math.min(nowMs, activeEndMs);
  const elapsedFraction = (clampedNow - activeStartMs) / (activeEndMs - activeStartMs);
  const pieElapsed = availableHours * elapsedFraction;
  const wastedHours = Math.min(availableHours, Math.max(0, pieElapsed - todayHours));

  return { wastedHours, started: true, finalized };
}
