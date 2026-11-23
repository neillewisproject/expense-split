import type { RecurringRule } from '../data/schema';
import { dateInTimeZone, dueDrafts, nextOccurrence, withoutRecurringReceipts } from './schedule';

const rule: RecurringRule = {
  id: 'rent',
  name: 'Rent',
  template: '{}',
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-01-31',
  nextDate: '2026-01-31',
  endDate: null,
  timeZone: null,
  active: true,
};
it('drops all receipt references when repeating a transaction, including older stored drafts', () => {
  const entry = {
    description: 'Meal',
    amount: 100,
    category: 'food' as const,
    date: '2026-03-01',
    receiptUri: 'file:///first.jpg',
    receiptUris: '["file:///first.jpg","file:///second.jpg"]',
  };
  expect(withoutRecurringReceipts(entry)).toEqual({
    ...entry,
    receiptUri: null,
    receiptUris: '[]',
  });
  expect(withoutRecurringReceipts({ ...entry, receiptUri: null }).receiptUris).toBe('[]');
});
it('uses fixed named calendar dates across midnight and daylight-saving transitions', () => {
  expect(dateInTimeZone(new Date('2026-03-08T07:30:00Z'), 'America/Los_Angeles')).toBe(
    '2026-03-07',
  );
  expect(dateInTimeZone(new Date('2026-03-08T10:30:00Z'), 'America/Los_Angeles')).toBe(
    '2026-03-08',
  );
  expect(dateInTimeZone(new Date('2026-11-01T08:30:00Z'), 'America/Los_Angeles')).toBe(
    '2026-11-01',
  );
  expect(dateInTimeZone(new Date('2026-11-01T09:30:00Z'), 'America/Los_Angeles')).toBe(
    '2026-11-01',
  );
  expect(() => dateInTimeZone(new Date(), 'not/a-zone')).toThrow('IANA time zone');
});
it('includes the last due date without generating later occurrences', () => {
  const result = dueDrafts({ ...rule, endDate: '2026-02-28' }, '2026-04-30', []);
  expect(result.drafts.map((draft) => draft.date)).toEqual(['2026-01-31', '2026-02-28']);
  expect(result.nextDate).toBe('2026-03-31');
  expect(dueDrafts({ ...rule, endDate: '2026-02-27' }, '2026-04-30', []).drafts).toHaveLength(1);
});
it('clamps month ends without drifting the original day', () => {
  const feb = nextOccurrence(rule, '2026-01-31');
  expect(feb).toBe('2026-02-28');
  expect(nextOccurrence(rule, feb)).toBe('2026-03-31');
  expect(
    nextOccurrence({ ...rule, startDate: '2024-02-29', frequency: 'yearly' }, '2024-02-29'),
  ).toBe('2025-02-28');
});
it('generates stable approval drafts without replaying approved or skipped occurrences', () => {
  const first = dueDrafts(rule, '2026-03-31', []);
  expect(first.drafts.map((draft) => draft.date)).toEqual([
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
  ]);
  expect(first.drafts.every((draft) => draft.status === 'pending')).toBe(true);
  expect(first.nextDate).toBe('2026-04-30');
  expect(
    dueDrafts(
      rule,
      '2026-03-31',
      first.drafts.map((draft) => ({ ...draft, status: 'approved' })),
    ).drafts,
  ).toEqual([]);
  expect(dueDrafts({ ...rule, active: false }, '2026-03-31', []).drafts).toEqual([]);
});
it('bounds catch-up while preserving the next unprocessed date', () => {
  const first = dueDrafts({ ...rule, frequency: 'daily' }, '2026-02-15', [], 2);
  expect(first.drafts).toHaveLength(2);
  expect(first.nextDate).toBe('2026-02-02');
});
