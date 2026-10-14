const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toKst(d: Date): Date {
  return new Date(d.getTime() + KST_OFFSET_MS);
}

// 기기 타임존 설정과 무관하게 항상 한국(KST, UTC+9) 기준 날짜를 반환한다.
export function localDateStr(d: Date = new Date()): string {
  const kst = toKst(d);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
}

export interface KstParts {
  year: number;
  month: number; // 1-12
  date: number;
  day: number; // 0=일 ~ 6=토
}

// 화면에 "오늘 날짜"/"이번 달"을 표시할 때도 기기 타임존이 아닌 KST 기준으로 읽어야 한다 (D-002).
// 반환된 Date 객체가 아닌 이 필드들을 사용한다 — getFullYear() 등 로컬 getter를 다시 호출하면 안 된다.
export function nowKstParts(d: Date = new Date()): KstParts {
  const kst = toKst(d);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    date: kst.getUTCDate(),
    day: kst.getUTCDay(),
  };
}

// 'YYYY-MM-DD' 날짜 문자열 두 개의 차이(일수, to - from)를 구한다.
// 이미 KST 기준 달력 날짜(문자열)이므로 시각 변환 없이 UTC 자정 기준으로 순수 계산한다.
export function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

// 'YYYY-MM-DD' 날짜 문자열에서 deltaDays만큼 이동한 날짜 문자열을 구한다 (음수면 과거).
export function shiftDateStr(s: string, deltaDays: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + deltaDays * 24 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

// 주어진 시각의, KST 기준 "오늘 자정부터 경과한 ms"를 구한다 (Time 탭 실시간 버려진 시간 계산용).
export function kstMsSinceMidnight(d: Date = new Date()): number {
  const kst = toKst(d);
  return (
    kst.getUTCHours() * 3600_000 +
    kst.getUTCMinutes() * 60_000 +
    kst.getUTCSeconds() * 1000 +
    kst.getUTCMilliseconds()
  );
}

// 'HH:MM'(또는 'HH:MM:SS') 문자열을 자정 기준 경과 ms로 변환한다.
export function hhmmToMs(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 3600_000 + m * 60_000;
}
