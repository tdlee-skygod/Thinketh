// 네이티브 날짜·시간 피커와 문자열을 오가는 변환.
// 피커가 돌려주는 Date는 사용자가 화면에서 직접 고른 달력 날짜·시각이므로,
// ("지금"을 KST로 변환하는 lib/date.ts의 localDateStr과 달리) 기기 로컬 getter로 그대로 읽는다 (D-002의 예외).

export function parsePickedDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatPickedDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseTimeToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function formatDateToTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
