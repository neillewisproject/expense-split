import type { StoredExpense } from '@/features/expenses/data/schema';
import { exportCsv, portableEntry, previewBackup, previewCsv, readCsv } from './portability';

const timestamp = '2026-03-01T00:00:00.000Z';
const entry: StoredExpense = {
  id: 'meal',
  description: 'Meal, with "friends"',
  amount: 2000,
  date: '2026-03-01',
  category: 'custom:Travel',
  receiptUri: null,
  notes: 'line one\nline two',
  tags: '["holiday"]',
  createdAt: timestamp,
  updatedAt: timestamp,
};
function backup() {
  return {
    format: 'expense-split-personal',
    version: 7,
    exportedAt: timestamp,
    omittedReceiptCount: 0,
    accounts: [],
    expenses: [portableEntry(entry)],
    budgets: [],
    rules: [],
    drafts: [],
    goals: [],
    contributions: [],
    cashMovements: [],
    settings: { defaultCurrency: 'INR', categories: ['Travel'], categoryRules: [] },
  };
}
it('round-trips quoted CSV, multiline notes, tags, IDs and minor-unit precision', () => {
  const text = exportCsv([
    entry,
    { ...entry, id: 'jpy', currency: 'JPY', amount: 123 },
    { ...entry, id: 'kwd', currency: 'KWD', amount: 1234 },
  ]);
  const preview = previewCsv(text, [], []);
  expect(preview.errors).toEqual([]);
  expect(preview.entries).toEqual([
    portableEntry(entry),
    portableEntry({ ...entry, id: 'jpy', currency: 'JPY', amount: 123 }),
    portableEntry({ ...entry, id: 'kwd', currency: 'KWD', amount: 1234 }),
  ]);
});
it('preserves category rules and upgrades older settings without inventing rules', () => {
  const rule = { id: 'rule', contains: 'train', entryType: 'expense', category: 'transport' };
  const current = { ...backup(), settings: { ...backup().settings, categoryRules: [rule] } };
  expect(previewBackup(JSON.stringify(current)).settings.categoryRules).toEqual([rule]);
  const { categoryRules: _rules, ...oldSettings } = current.settings;
  expect(
    previewBackup(JSON.stringify({ ...current, version: 6, settings: oldSettings })).settings
      .categoryRules,
  ).toEqual([]);
  expect(() => previewBackup(JSON.stringify({ ...current, settings: oldSettings }))).toThrow(
    'category rules',
  );
  expect(() =>
    previewBackup(
      JSON.stringify({
        ...current,
        settings: { ...current.settings, categoryRules: [rule, { ...rule, id: 'duplicate' }] },
      }),
    ),
  ).toThrow('distinct');
});
it('skips exact ID duplicates but blocks different data using the same ID', () => {
  expect(previewCsv(exportCsv([entry]), [], [entry])).toMatchObject({
    entries: [],
    duplicates: 1,
    errors: [],
  });
  expect(previewCsv(exportCsv([{ ...entry, amount: 123 }]), [], [entry]).errors[0]).toContain(
    'conflicts',
  );
});
it('disarms spreadsheet formula cells while preserving their text through a round trip', () => {
  const source = { ...entry, description: '=HYPERLINK("example")', notes: "'original note" };
  const csv = exportCsv([source]);
  expect(readCsv(csv)[1]?.[1]).toBe('\'=HYPERLINK("example")');
  expect(previewCsv(csv, [], []).entries[0]).toEqual(portableEntry(source));
});
it('rejects malformed CSV and missing accounts before commit', () => {
  expect(() => readCsv('one,"unclosed')).toThrow('Unclosed');
  expect(previewCsv(exportCsv([{ ...entry, accountId: 'unknown' }]), [], []).errors[0]).toContain(
    'active account',
  );
});
it('round-trips versioned personal financial data without importing auth tokens or arbitrary local URIs', () => {
  const value = backup();
  expect(previewBackup(JSON.stringify(value))).toEqual(value);
  expect(
    portableEntry({
      ...entry,
      receiptUri: 'file:///first.jpg',
      receiptUris: JSON.stringify(['file:///first.jpg', 'file:///second.jpg']),
    }),
  ).toMatchObject({ receiptUri: null, receiptUris: '[]' });
  expect(() => previewBackup(JSON.stringify({ ...value, access_token: 'no' }))).toThrow(
    'Invalid backup',
  );
  expect(() =>
    previewBackup(
      JSON.stringify({
        ...value,
        expenses: [{ ...portableEntry(entry), receiptUri: 'file:///other-app/private' }],
      }),
    ),
  ).toThrow('Invalid backup');
  expect(() =>
    previewBackup(
      JSON.stringify({
        ...value,
        expenses: [
          { ...portableEntry(entry), receiptUris: JSON.stringify(['file:///private.jpg']) },
        ],
      }),
    ),
  ).toThrow('Invalid backup');
  expect(() => previewBackup(JSON.stringify({ ...value, version: 8 }))).toThrow('Invalid backup');
});
it('upgrades old financial backups and validates new savings relationships', () => {
  const { goals: _goals, contributions: _contributions, ...old } = backup();
  expect(previewBackup(JSON.stringify({ ...old, version: 1 }))).toEqual(backup());
  expect(() => previewBackup(JSON.stringify(old))).toThrow('backups require goals');
  expect(() =>
    previewBackup(
      JSON.stringify({
        ...backup(),
        contributions: [
          {
            id: 'missing',
            goalId: 'unknown',
            amount: 100,
            date: '2026-03-01',
            note: '',
            createdAt: timestamp,
          },
        ],
      }),
    ),
  ).toThrow('missing goal');
});
it('preserves group cash snapshots and rejects missing accounts and duplicate active links', () => {
  const movement = {
    id: 'cash-1',
    groupId: 'group',
    expenseId: 'meal',
    memberId: 'me',
    accountId: 'cash',
    personalEntryId: null,
    currency: 'INR',
    amount: 200,
    direction: 'out',
    date: '2026-03-01',
    description: 'Shared meal',
    groupName: 'Trip',
    expenseRevision: 1,
    createdAt: timestamp,
    voidedAt: null,
  };
  const account = {
    id: 'cash',
    name: 'Cash',
    currency: 'INR',
    openingBalance: 1000,
    archived: false,
    createdAt: timestamp,
  };
  const value = { ...backup(), accounts: [account], cashMovements: [movement] };
  expect(previewBackup(JSON.stringify(value))).toEqual(value);
  const { cashMovements: _cash, ...old } = value;
  expect(previewBackup(JSON.stringify({ ...old, version: 3 })).cashMovements).toEqual([]);
  expect(() => previewBackup(JSON.stringify(old))).toThrow('Version 4 and later require');
  expect(() => previewBackup(JSON.stringify({ ...value, accounts: [] }))).toThrow(
    'different-currency account',
  );
  expect(() =>
    previewBackup(
      JSON.stringify({ ...value, cashMovements: [movement, { ...movement, id: 'cash-2' }] }),
    ),
  ).toThrow('duplicate active');
  expect(
    previewBackup(
      JSON.stringify({
        ...value,
        cashMovements: [
          { ...movement, voidedAt: timestamp },
          { ...movement, id: 'cash-2' },
        ],
      }),
    ).cashMovements,
  ).toHaveLength(2);
});
it('upgrades v4 cash snapshots and validates v5 transaction matches', () => {
  const account = {
    id: 'cash',
    name: 'Cash',
    currency: 'INR',
    openingBalance: 1000,
    archived: false,
    createdAt: timestamp,
  };
  const personal = portableEntry({ ...entry, accountId: 'cash' });
  const movement = {
    id: 'cash-1',
    groupId: 'group',
    expenseId: 'meal',
    memberId: 'me',
    accountId: 'cash',
    currency: 'INR',
    amount: personal.amount,
    direction: 'out',
    date: personal.date,
    description: 'Meal',
    groupName: 'Trip',
    expenseRevision: 1,
    createdAt: timestamp,
    voidedAt: null,
  };
  const old = {
    ...backup(),
    version: 4,
    accounts: [account],
    expenses: [personal],
    cashMovements: [movement],
  };
  expect(previewBackup(JSON.stringify(old)).cashMovements[0]?.personalEntryId).toBeNull();
  expect(() => previewBackup(JSON.stringify({ ...old, version: 5 }))).toThrow('match field');
  const matched = {
    ...old,
    version: 5,
    cashMovements: [{ ...movement, personalEntryId: personal.id }],
  };
  expect(previewBackup(JSON.stringify(matched)).cashMovements[0]?.personalEntryId).toBe(
    personal.id,
  );
  expect(() => previewBackup(JSON.stringify({ ...matched, expenses: [] }))).toThrow(
    'missing or incompatible',
  );
  expect(() =>
    previewBackup(
      JSON.stringify({
        ...matched,
        cashMovements: [
          matched.cashMovements[0],
          { ...matched.cashMovements[0], id: 'cash-2', expenseId: 'other' },
        ],
      }),
    ),
  ).toThrow('duplicate matched');
});
it('round-trips bounded zoned schedules and upgrades legacy schedules to device time', () => {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    deletedAt: _deletedAt,
    ...input
  } = portableEntry(entry);
  const schedule = {
    id: 'monthly',
    name: 'Monthly meal',
    template: JSON.stringify(input),
    startDate: '2026-03-01',
    frequency: 'monthly',
    interval: 1,
    nextDate: '2026-03-01',
    active: true,
    endDate: '2026-05-01',
    timeZone: 'Asia/Kolkata',
  };
  const value = { ...backup(), rules: [schedule] };
  expect(previewBackup(JSON.stringify(value))).toEqual(value);
  const { endDate: _end, timeZone: _zone, ...legacy } = schedule;
  expect(previewBackup(JSON.stringify({ ...value, version: 2, rules: [legacy] })).rules).toEqual([
    { ...legacy, endDate: null, timeZone: null },
  ]);
  expect(() => previewBackup(JSON.stringify({ ...value, rules: [legacy] }))).toThrow(
    'Version 3 schedules require',
  );
  expect(() =>
    previewBackup(JSON.stringify({ ...value, rules: [{ ...schedule, endDate: '2026-02-28' }] })),
  ).toThrow('end date precedes');
  expect(() =>
    previewBackup(JSON.stringify({ ...value, rules: [{ ...schedule, timeZone: 'not/a-zone' }] })),
  ).toThrow('IANA time zone');
});
it('preserves savings reservations/releases and linked budget carryover', () => {
  const previous = {
    id: 'previous',
    name: 'Monthly budget',
    month: '2026-02',
    currency: 'INR',
    amount: 1000,
    category: null,
    accountId: null,
    tag: null,
    threshold: 80,
    carryoverFromId: null,
    basis: 'personal',
  };
  const value = {
    ...backup(),
    accounts: [
      {
        id: 'cash',
        name: 'Cash',
        currency: 'INR',
        openingBalance: 10000,
        archived: false,
        createdAt: timestamp,
      },
    ],
    budgets: [
      previous,
      { ...previous, id: 'current', month: '2026-03', carryoverFromId: previous.id },
    ],
    goals: [
      {
        id: 'trip',
        name: 'Trip',
        accountId: 'cash',
        currency: 'INR',
        target: 5000,
        targetDate: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    contributions: [
      {
        id: 'reserve',
        goalId: 'trip',
        amount: 1200,
        date: '2026-03-01',
        note: 'Reserve',
        createdAt: timestamp,
      },
      {
        id: 'release',
        goalId: 'trip',
        amount: -200,
        date: '2026-03-01',
        note: 'Release',
        createdAt: timestamp,
      },
    ],
  };
  expect(previewBackup(JSON.stringify(value))).toEqual(value);
  expect(() =>
    previewBackup(
      JSON.stringify({
        ...value,
        contributions: [{ ...value.contributions[0], amount: -1 }],
      }),
    ),
  ).toThrow('releases exceed reserved funds');
  expect(() =>
    previewBackup(
      JSON.stringify({
        ...value,
        budgets: [{ ...previous, carryoverFromId: 'unknown' }],
      }),
    ),
  ).toThrow();
  expect(() =>
    previewBackup(
      JSON.stringify({
        ...value,
        contributions: [
          { ...value.contributions[0], amount: Number.MAX_SAFE_INTEGER },
          { ...value.contributions[1], amount: 1 },
        ],
      }),
    ),
  ).toThrow();
});
it('upgrades old budgets to personal-only and preserves validated combined budget bases', () => {
  const budget = {
    id: 'budget',
    name: 'Monthly',
    month: '2026-03',
    currency: 'INR',
    amount: 1000,
    category: null,
    accountId: null,
    tag: null,
    threshold: 80,
    carryoverFromId: null,
  };
  const old = { ...backup(), version: 5, budgets: [budget] };
  expect(previewBackup(JSON.stringify(old)).budgets[0]?.basis).toBe('personal');
  expect(() => previewBackup(JSON.stringify({ ...old, version: 6 }))).toThrow('budget');
  const combined = { ...old, version: 6, budgets: [{ ...budget, basis: 'combined' }] };
  expect(previewBackup(JSON.stringify(combined)).budgets[0]?.basis).toBe('combined');
  expect(() =>
    previewBackup(
      JSON.stringify({
        ...combined,
        budgets: [{ ...budget, basis: 'combined', tag: 'trip' }],
      }),
    ),
  ).toThrow('account or tag');
});
it('rejects broken references, duplicate IDs and over-refunds', () => {
  const value = backup();
  expect(() =>
    previewBackup(
      JSON.stringify({ ...value, expenses: [portableEntry(entry), portableEntry(entry)] }),
    ),
  ).toThrow('duplicate');
  expect(() =>
    previewBackup(
      JSON.stringify({ ...value, expenses: [portableEntry({ ...entry, accountId: 'missing' })] }),
    ),
  ).toThrow('missing account');
  expect(() =>
    previewBackup(
      JSON.stringify({
        ...value,
        expenses: [
          portableEntry(entry),
          portableEntry({
            ...entry,
            id: 'refund',
            entryType: 'refund',
            refundOfId: entry.id,
            amount: 2100,
          }),
        ],
      }),
    ),
  ).toThrow('invalidate linked refunds');
});
