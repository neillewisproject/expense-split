import { expenseFormSchema } from '@/features/expenses/domain/expense';

export type DatePeriod = { start: string; end: string };
function checkedDate(value: string): Date {
  if (!expenseFormSchema.shape.date.safeParse(value).success)
    throw new Error('Enter a valid YYYY-MM-DD calendar date');
  return new Date(`${value}T00:00:00Z`);
}
function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function validatePeriod(period: DatePeriod): DatePeriod {
  checkedDate(period.start);
  checkedDate(period.end);
  if (period.start > period.end) throw new Error('Start date must not follow end date');
  return period;
}
export function monthPeriod(month: string): DatePeriod {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Use YYYY-MM for the month');
  const start = `${month}-01`;
  const end = checkedDate(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return { start, end: iso(end) };
}
export function previousMonth(month: string): string {
  const date = checkedDate(monthPeriod(month).start);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return iso(date).slice(0, 7);
}
export function calendarPeriod(kind: 'month' | 'week' | 'year', anchor: string): DatePeriod {
  const date = checkedDate(anchor);
  if (kind === 'month') return monthPeriod(anchor.slice(0, 7));
  if (kind === 'year')
    return { start: `${anchor.slice(0, 4)}-01-01`, end: `${anchor.slice(0, 4)}-12-31` };
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: iso(date), end: iso(end) };
}
export function previousPeriod(
  period: DatePeriod,
  kind: 'month' | 'week' | 'year' | 'custom',
): DatePeriod {
  validatePeriod(period);
  if (kind === 'month') return monthPeriod(previousMonth(period.start.slice(0, 7)));
  if (kind === 'year') {
    const date = checkedDate(period.start);
    date.setUTCFullYear(date.getUTCFullYear() - 1);
    return calendarPeriod('year', iso(date));
  }
  const days =
    (checkedDate(period.end).getTime() - checkedDate(period.start).getTime()) / 86400000 + 1;
  const start = checkedDate(period.start);
  const end = checkedDate(period.start);
  start.setUTCDate(start.getUTCDate() - days);
  end.setUTCDate(end.getUTCDate() - 1);
  return { start: iso(start), end: iso(end) };
}
