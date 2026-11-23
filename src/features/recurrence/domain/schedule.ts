import type { RecurringDraft, RecurringRule } from '../data/schema';
import { localDate, type ExpenseInput } from '@/features/expenses/domain/expense';

export function withoutRecurringReceipts(entry: ExpenseInput): ExpenseInput {
  return { ...entry, receiptUri: null, receiptUris: '[]' };
}

export function dateInTimeZone(now: Date, timeZone: string | null): string {
  if (!timeZone) return localDate(now);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
  } catch {
    throw new Error('Choose a supported IANA time zone, such as Asia/Kolkata');
  }
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Could not determine the schedule date');
  return `${year.padStart(4, '0')}-${month}-${day}`;
}

export function nextOccurrence(
  rule: Pick<RecurringRule, 'startDate' | 'frequency' | 'interval'>,
  date: string,
): string {
  const current = new Date(`${date}T00:00:00Z`);
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 365)
    throw new Error('Interval must be between 1 and 365');
  if (rule.frequency === 'daily' || rule.frequency === 'weekly') {
    current.setUTCDate(
      current.getUTCDate() + rule.interval * (rule.frequency === 'weekly' ? 7 : 1),
    );
  } else {
    const day = Number(rule.startDate.slice(8, 10));
    current.setUTCDate(1);
    current.setUTCMonth(
      current.getUTCMonth() + rule.interval * (rule.frequency === 'yearly' ? 12 : 1),
    );
    const lastDay = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
    ).getUTCDate();
    current.setUTCDate(Math.min(day, lastDay));
  }
  return current.toISOString().slice(0, 10);
}

export function dueDrafts(
  rule: RecurringRule,
  through: string,
  existing: RecurringDraft[],
  limit = 100,
): { drafts: RecurringDraft[]; nextDate: string } {
  const drafts: RecurringDraft[] = [];
  let date = rule.nextDate;
  let processed = 0;
  while (
    rule.active &&
    date <= through &&
    (!rule.endDate || date <= rule.endDate) &&
    processed < limit
  ) {
    const id = `${rule.id}:${date}`;
    if (!existing.some((item) => item.id === id))
      drafts.push({ id, ruleId: rule.id, date, template: rule.template, status: 'pending' });
    date = nextOccurrence(rule, date);
    processed++;
  }
  return { drafts, nextDate: date };
}
