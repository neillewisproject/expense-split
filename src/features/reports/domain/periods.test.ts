import { calendarPeriod, monthPeriod, previousPeriod, validatePeriod } from './periods';
it('handles leap-year months and prior calendar months rather than a fixed thirty-day approximation', () => {
  const february = monthPeriod('2024-02');
  expect(february).toEqual({ start: '2024-02-01', end: '2024-02-29' });
  expect(previousPeriod(february, 'month')).toEqual({ start: '2024-01-01', end: '2024-01-31' });
  expect(previousPeriod(monthPeriod('2026-01'), 'month')).toEqual({
    start: '2025-12-01',
    end: '2025-12-31',
  });
});
it('compares an inclusive custom range with the immediately preceding same number of days', () => {
  expect(previousPeriod({ start: '2026-03-01', end: '2026-03-02' }, 'custom')).toEqual({
    start: '2026-02-27',
    end: '2026-02-28',
  });
  expect(calendarPeriod('week', '2026-03-01')).toEqual({ start: '2026-02-23', end: '2026-03-01' });
});
it('rejects reversed ranges and impossible dates', () => {
  expect(() => validatePeriod({ start: '2026-03-02', end: '2026-03-01' })).toThrow('Start date');
  expect(() => validatePeriod({ start: '2026-02-30', end: '2026-03-01' })).toThrow('calendar date');
});
