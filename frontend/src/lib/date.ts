// 'YYYY-MM-DD' 문자열 기준 D-day 계산 유틸.

export function parseYmd(date: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

export function toYmd(y: number, m: number, d: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

function startOfToday(): number {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
}

// 오늘 기준 남은/지난 일수. 미래면 양수, 오늘이면 0, 과거면 음수.
export function daysUntil(date: string): number {
  const p = parseYmd(date);
  if (!p) return 0;
  const target = new Date(p.y, p.m - 1, p.d).getTime();
  return Math.round((target - startOfToday()) / 86_400_000);
}

export function ddayLabel(date: string): string {
  const diff = daysUntil(date);
  if (diff === 0) return 'D-DAY';
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatKoreanDate(date: string): string {
  const p = parseYmd(date);
  if (!p) return date;
  const wd = WEEKDAYS[new Date(p.y, p.m - 1, p.d).getDay()];
  return `${p.y}년 ${p.m}월 ${p.d}일 (${wd})`;
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
