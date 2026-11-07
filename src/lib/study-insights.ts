const dayFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

export function studyDayKey(date: Date) { return dayFormatter.format(date); }

function shiftDay(key: string, offset: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function studyWeek<T extends { date: string; questions: number; correct: number; estimatedMinutes: number }>(days: T[], now = new Date()) {
  const today = studyDayKey(now);
  const monday = shiftDay(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const byDay = new Map(days.map(day => [day.date, day]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDay(monday, index);
    return { date, questions: byDay.get(date)?.questions ?? 0, correct: byDay.get(date)?.correct ?? 0, minutes: byDay.get(date)?.estimatedMinutes ?? 0, today: date === today, future: date > today };
  });
}

export function currentStudyStreak(dayKeys: string[], now = new Date()) {
  const dates = new Set(dayKeys);
  let cursor = studyDayKey(now);
  if (!dates.has(cursor)) cursor = shiftDay(cursor, -1);
  let streak = 0;
  while (dates.has(cursor)) { streak += 1; cursor = shiftDay(cursor, -1); }
  return streak;
}

// Legacy free-text references stay readable. Only HTTP(S) links can be opened.
export function safeStudyUrl(value: string | null | undefined) {
  if (!value) return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

export function referenceUrl(value: string | null | undefined) {
  return safeStudyUrl(value?.match(/https?:\/\/[^\s<>]+/i)?.[0]);
}

export function normalizeStudySearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}
