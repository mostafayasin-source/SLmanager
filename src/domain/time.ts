export const SALON_TIME_ZONE = 'Europe/Stockholm';

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function isYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizeHm(value: string): string | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonthsYmd(ymd: string, months: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const target = month - 1 + months;
  const nextYear = year + Math.floor(target / 12);
  const nextMonth = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  const nextDay = Math.min(day, lastDay);
  return new Date(Date.UTC(nextYear, nextMonth, nextDay)).toISOString().slice(0, 10);
}

export function mondayOf(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function zonedParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '0';
  let hour = Number(read('hour'));
  if (hour === 24) hour = 0;
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour,
    minute: Number(read('minute')),
  };
}

export function stockholmYmdFromDate(date: Date): string {
  const parts = zonedParts(date, SALON_TIME_ZONE);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function stockholmToday(now = new Date()): string {
  return stockholmYmdFromDate(now);
}

export function stockholmYmdFromIso(iso: string): string {
  return stockholmYmdFromDate(new Date(iso));
}

export function stockholmHmFromIso(iso: string): string {
  const parts = zonedParts(new Date(iso), SALON_TIME_ZONE);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function stockholmDateTimeToIso(ymd: string, hm: string): string {
  const time = normalizeHm(hm);
  if (!isYmd(ymd) || !time) throw new Error('Ogiltigt datum eller klockslag.');
  const [year, month, day] = ymd.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(guess), SALON_TIME_ZONE);
    const got = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const want = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = want - got;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess).toISOString();
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

export function formatSwedishDate(ymd: string, style: 'long' | 'medium' | 'weekday' = 'medium'): string {
  if (!isYmd(ymd)) return ymd;
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
      : style === 'weekday'
        ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
        : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat('sv-SE', options).format(date);
}

export function formatSwedishDateTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: SALON_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function formatSek(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatHours(ms: number): string {
  const hours = ms / 3_600_000;
  const formatted = new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(hours);
  return `${formatted} tim`;
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysYmd(weekStart, index));
}

export function formatWeekLabel(weekStart: string): string {
  const end = addDaysYmd(weekStart, 6);
  const startLabel = formatSwedishDate(weekStart, 'weekday');
  const endLabel = formatSwedishDate(end, 'medium');
  return `${startLabel} – ${endLabel}`;
}
