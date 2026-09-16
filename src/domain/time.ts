import type { ISODate, ISODateTime } from './types';

export function nowIso(): ISODateTime {
  return new Date().toISOString();
}

export function localDateOf(date: Date = new Date()): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function tzOffsetMinutes(date: Date = new Date()): number {
  // getTimezoneOffset() returns minutes *behind* UTC; invert so +60 means UTC+1.
  return -date.getTimezoneOffset();
}

export function parseIso(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type RangeKey = '1m' | '3m' | '6m' | '1y' | 'all';

export const RANGE_LABELS: Record<RangeKey, string> = {
  '1m': '1M',
  '3m': '3M',
  '6m': '6M',
  '1y': '1Y',
  all: 'All',
};

export const RANGE_DESCRIPTIONS: Record<RangeKey, string> = {
  '1m': 'Last month',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '1y': 'Last year',
  all: 'All time',
};

const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = {
  '1m': 30,
  '3m': 91,
  '6m': 182,
  '1y': 365,
};

export interface DateRange {
  from: Date | null;
  to: Date;
}

export function resolveRange(key: RangeKey, reference: Date = new Date()): DateRange {
  if (key === 'all') return { from: null, to: reference };
  const from = new Date(reference);
  from.setDate(from.getDate() - RANGE_DAYS[key]);
  from.setHours(0, 0, 0, 0);
  return { from, to: reference };
}

/** The equivalent window immediately before `range`, used for period-over-period deltas. */
export function previousRange(key: RangeKey, reference: Date = new Date()): DateRange | null {
  if (key === 'all') return null;
  const days = RANGE_DAYS[key];
  const to = new Date(reference);
  to.setDate(to.getDate() - days);
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function isWithin(range: DateRange, value: Date): boolean {
  if (range.from && value < range.from) return false;
  return value <= range.to;
}

export function formatDate(value: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? parseIso(value) : value;
  if (!date) return '—';
  return new Intl.DateTimeFormat(undefined, opts ?? { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? parseIso(value) : value;
  if (!date) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
}

export function relativeDay(value: string | Date): string {
  const date = typeof value === 'string' ? parseIso(value) : value;
  if (!date) return '—';
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfValue = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfValue.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return formatDate(date);
}

/** Seconds elapsed in a workout, excluding paused time. */
export function elapsedSeconds(
  startedAt: string,
  endedAt: string | undefined,
  pausedSeconds = 0,
): number {
  const start = parseIso(startedAt);
  if (!start) return 0;
  const end = endedAt ? parseIso(endedAt) : new Date();
  if (!end) return 0;
  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 1000) - Math.max(0, pausedSeconds),
  );
}
