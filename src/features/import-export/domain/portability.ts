import { z } from 'zod';
import type { Account } from '@/features/accounts/data/schema';
import type { StoredExpense } from '@/features/expenses/data/schema';
import { expenseFormSchema } from '@/features/expenses/domain/expense';
import { validateEntry } from '@/features/expenses/domain/ledger';
import { amountToInput, parseAmount, SUPPORTED_CURRENCIES } from '@/features/expenses/domain/money';
import { dateInTimeZone, nextOccurrence } from '@/features/recurrence/domain/schedule';
import { goalSaved, validateGoal } from '@/features/goals/domain/goals';
import { budgetProgress, validateCarryover } from '@/features/reports/domain/reports';
import { matchesCashTransaction } from '@/features/group-cash/domain/cash';
import { categoryRulesSchema } from '@/features/settings/domain/category-rules';

const safeInteger = z.number().refine(Number.isSafeInteger, 'Use safe integer minor units');
const currency = z
  .string()
  .refine((value) => SUPPORTED_CURRENCIES.includes(value), 'Unsupported currency');
const id = z.string().min(1).max(200);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });
const timestamp = z.string().datetime();
const tags = z.string().refine((value) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return (
      Array.isArray(parsed) &&
      parsed.length <= 30 &&
      parsed.every((item) => typeof item === 'string' && item.length <= 40)
    );
  } catch {
    return false;
  }
});
const entrySchema = z
  .object({
    id,
    description: z.string().trim().min(1).max(80),
    amount: safeInteger.refine((value) => value > 0),
    currency,
    entryType: z.enum(['expense', 'income', 'refund', 'transfer']),
    category: expenseFormSchema.shape.category,
    date,
    receiptUri: z.null(),
    receiptUris: z.literal('[]').default('[]'),
    accountId: id.nullable(),
    toAccountId: id.nullable(),
    refundOfId: id.nullable(),
    notes: z.string().max(2000),
    tags,
    deletedAt: timestamp.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();
const accountSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(80),
    currency,
    openingBalance: safeInteger,
    archived: z.boolean(),
    createdAt: timestamp,
  })
  .strict();
const budgetSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(80),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    currency,
    amount: safeInteger.refine((value) => value > 0),
    category: expenseFormSchema.shape.category.nullable(),
    accountId: id.nullable(),
    tag: z.string().max(40).nullable(),
    threshold: z.number().int().min(1).max(100),
    carryoverFromId: id.nullable().optional(),
    basis: z.enum(['personal', 'combined']).optional(),
  })
  .strict();
const templateSchema = entrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});
const template = z.string().refine((value) => {
  try {
    return templateSchema.safeParse(JSON.parse(value)).success;
  } catch {
    return false;
  }
}, 'Invalid recurrence template');
const ruleSchema = z
  .object({
    id,
    name: z.string().min(1).max(80),
    template,
    startDate: date,
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z.number().int().min(1).max(365),
    nextDate: date,
    endDate: date.nullable().optional(),
    timeZone: z.string().min(1).max(100).nullable().optional(),
    active: z.boolean(),
  })
  .strict();
const draftSchema = z
  .object({ id, ruleId: id, date, template, status: z.enum(['pending', 'approved', 'skipped']) })
  .strict();
const goalSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(80),
    accountId: id,
    currency,
    target: safeInteger.refine((value) => value > 0),
    targetDate: date.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();
const contributionSchema = z
  .object({
    id,
    goalId: id,
    amount: safeInteger.refine((value) => value !== 0),
    date,
    note: z.string().max(400),
    createdAt: timestamp,
  })
  .strict();
const cashMovementSchema = z
  .object({
    id,
    groupId: id,
    expenseId: id,
    memberId: id,
    accountId: id,
    personalEntryId: id.nullable().optional(),
    currency,
    amount: safeInteger.refine((value) => value > 0),
    direction: z.enum(['in', 'out']),
    date,
    description: z.string().trim().min(1).max(80),
    groupName: z.string().trim().min(1).max(80),
    expenseRevision: z.number().int().min(0).max(2147483647),
    createdAt: timestamp,
    voidedAt: timestamp.nullable(),
  })
  .strict();
export const backupSchema = z
  .object({
    format: z.literal('expense-split-personal'),
    version: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
      z.literal(7),
    ]),
    exportedAt: timestamp,
    omittedReceiptCount: z.number().int().nonnegative(),
    accounts: z.array(accountSchema).max(10000),
    expenses: z.array(entrySchema).max(100000),
    budgets: z.array(budgetSchema).max(10000),
    rules: z.array(ruleSchema).max(10000),
    drafts: z.array(draftSchema).max(100000),
    goals: z.array(goalSchema).max(10000).optional(),
    contributions: z.array(contributionSchema).max(100000).optional(),
    cashMovements: z.array(cashMovementSchema).max(100000).optional(),
    settings: z
      .object({
        defaultCurrency: currency,
        categories: z.array(z.string().trim().min(1).max(40)).max(50),
        categoryRules: categoryRulesSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.version >= 2 && (!value.goals || !value.contributions)) {
      context.addIssue({
        code: 'custom',
        message: 'Version 2 and later backups require goals and contributions',
      });
    }
    if (
      value.version >= 3 &&
      value.rules.some((rule) => rule.endDate === undefined || rule.timeZone === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Version 3 schedules require end-date and time-zone fields',
      });
    }
    if (value.version >= 4 && !value.cashMovements) {
      context.addIssue({
        code: 'custom',
        message: 'Version 4 and later require group cash movements',
      });
    }
    if (
      value.version >= 5 &&
      value.cashMovements?.some((row) => row.personalEntryId === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Version 5 cash movements require a transaction match field',
      });
    }
    if (value.version >= 6 && value.budgets.some((budget) => budget.basis === undefined)) {
      context.addIssue({ code: 'custom', message: 'Version 6 budgets require a basis' });
    }
    if (value.version >= 7 && value.settings.categoryRules === undefined) {
      context.addIssue({ code: 'custom', message: 'Version 7 settings require category rules' });
    }
  })
  .transform((value) => ({
    ...value,
    version: 7 as const,
    settings: { ...value.settings, categoryRules: value.settings.categoryRules ?? [] },
    budgets: value.budgets.map((budget) => ({
      ...budget,
      carryoverFromId: budget.carryoverFromId ?? null,
      basis: budget.basis ?? ('personal' as const),
    })),
    rules: value.rules.map((rule) => ({
      ...rule,
      endDate: rule.endDate ?? null,
      timeZone: rule.timeZone ?? null,
    })),
    goals: value.goals ?? [],
    contributions: value.contributions ?? [],
    cashMovements: (value.cashMovements ?? []).map((movement) => ({
      ...movement,
      personalEntryId: movement.personalEntryId ?? null,
    })),
  }));
export type PersonalBackup = z.infer<typeof backupSchema>;

export function portableEntry(entry: StoredExpense) {
  return {
    ...entry,
    currency: entry.currency ?? 'INR',
    entryType: entry.entryType ?? 'expense',
    receiptUri: null,
    receiptUris: '[]',
    accountId: entry.accountId ?? null,
    toAccountId: entry.toAccountId ?? null,
    refundOfId: entry.refundOfId ?? null,
    notes: entry.notes ?? '',
    tags: entry.tags ?? '[]',
    deletedAt: entry.deletedAt ?? null,
  };
}
export function portableTemplate(text: string): string {
  const value = JSON.parse(text) as StoredExpense;
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    deletedAt: _deletedAt,
    ...input
  } = portableEntry(value);
  return JSON.stringify(input);
}
export function previewBackup(text: string): PersonalBackup {
  if (text.length > 20_000_000) throw new Error('Backup is too large (20 MB text limit)');
  const result = backupSchema.safeParse(JSON.parse(text) as unknown);
  if (!result.success)
    throw new Error(
      `Invalid backup: ${result.error.issues[0]?.path.join('.')} ${result.error.issues[0]?.message}`,
    );
  const backup = result.data;
  for (const rows of [
    backup.accounts,
    backup.expenses,
    backup.budgets,
    backup.rules,
    backup.drafts,
    backup.goals,
    backup.contributions,
    backup.cashMovements,
  ]) {
    if (new Set(rows.map((row) => row.id)).size !== rows.length)
      throw new Error('Backup contains duplicate IDs');
  }
  const historicalAccounts = backup.accounts.map((account) => ({ ...account, archived: false }));
  for (const entry of backup.expenses) {
    if (entry.accountId && !backup.accounts.some((account) => account.id === entry.accountId))
      throw new Error('Transaction references a missing account');
    if (entry.toAccountId && !backup.accounts.some((account) => account.id === entry.toAccountId))
      throw new Error('Transfer references a missing account');
    if (!entry.deletedAt) validateEntry(entry, historicalAccounts, backup.expenses, entry.id);
  }
  const personalBudgets = backup.budgets.map((budget) => ({
    ...budget,
    basis: 'personal' as const,
  }));
  for (const budget of backup.budgets) {
    validateCarryover(budget, backup.budgets);
    if (budget.basis === 'combined' && (budget.accountId || budget.tag))
      throw new Error('Combined budgets cannot filter by account or tag');
    budgetProgress({ ...budget, basis: 'personal' }, backup.expenses, personalBudgets);
    if (
      budget.accountId &&
      !backup.accounts.some(
        (account) => account.id === budget.accountId && account.currency === budget.currency,
      )
    )
      throw new Error('Budget references a missing or different-currency account');
  }
  for (const goal of backup.goals) {
    validateGoal(goal, historicalAccounts);
    if (goalSaved(goal.id, backup.contributions) < 0)
      throw new Error('Goal releases exceed reserved funds');
  }
  for (const contribution of backup.contributions) {
    if (!backup.goals.some((goal) => goal.id === contribution.goalId))
      throw new Error('Contribution references a missing goal');
  }
  const activeCashLinks = new Set<string>();
  const activeMatches = new Set<string>();
  for (const movement of backup.cashMovements) {
    if (
      !backup.accounts.some(
        (account) => account.id === movement.accountId && account.currency === movement.currency,
      )
    )
      throw new Error('Group cash movement references a missing or different-currency account');
    const key = JSON.stringify([
      movement.groupId,
      movement.expenseId,
      movement.memberId,
      movement.direction,
    ]);
    if (!movement.voidedAt && activeCashLinks.has(key))
      throw new Error('Backup contains duplicate active group cash links');
    if (!movement.voidedAt) activeCashLinks.add(key);
    if (!movement.voidedAt && movement.personalEntryId) {
      const entry = backup.expenses.find((item) => item.id === movement.personalEntryId);
      if (!entry || !matchesCashTransaction(movement, entry))
        throw new Error('Group cash match references a missing or incompatible transaction');
      if (activeMatches.has(movement.personalEntryId))
        throw new Error('Backup contains a duplicate matched personal transaction');
      activeMatches.add(movement.personalEntryId);
    }
  }
  for (const rule of backup.rules) {
    const input = JSON.parse(rule.template) as z.infer<typeof templateSchema>;
    if (input.entryType === 'refund') throw new Error('Recurring refunds are not supported');
    validateEntry(input, historicalAccounts, backup.expenses);
    if (rule.nextDate < rule.startDate) throw new Error('Schedule next date precedes its start');
    if (rule.endDate && rule.endDate < rule.startDate)
      throw new Error('Schedule end date precedes its start');
    if (rule.timeZone) dateInTimeZone(new Date(), rule.timeZone);
    nextOccurrence(rule, rule.nextDate);
  }
  for (const draft of backup.drafts) {
    if (!backup.rules.some((rule) => rule.id === draft.ruleId))
      throw new Error('Draft references a missing schedule');
    if (draft.id !== `${draft.ruleId}:${draft.date}`)
      throw new Error('Invalid recurring draft identity');
    const input = JSON.parse(draft.template) as z.infer<typeof templateSchema>;
    if (input.entryType === 'refund') throw new Error('Recurring refunds are not supported');
    validateEntry(input, historicalAccounts, backup.expenses);
    if (
      draft.status === 'approved' &&
      !backup.expenses.some((entry) => entry.id === `recurring:${draft.id}`)
    )
      throw new Error('Approved draft is missing its posted transaction');
  }
  return backup;
}

export const CSV_HEADERS = [
  'id',
  'description',
  'amount',
  'currency',
  'entryType',
  'category',
  'date',
  'accountId',
  'toAccountId',
  'refundOfId',
  'notes',
  'tags',
  'deletedAt',
  'createdAt',
  'updatedAt',
] as const;
function quote(value: string): string {
  const safe = /^[\s]*[=+\-@]|^[\t\r\n']/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
function unescapeCell(value: string): string {
  return value.startsWith("'") && /^[\s]*[=+\-@]|^[\t\r\n']/.test(value.slice(1))
    ? value.slice(1)
    : value;
}
export function exportCsv(entries: StoredExpense[]): string {
  return [
    CSV_HEADERS.join(','),
    ...entries.map((row) => {
      const entry = portableEntry(row);
      return CSV_HEADERS.map((key) =>
        quote(
          key === 'amount' ? amountToInput(entry.amount, entry.currency) : String(entry[key] ?? ''),
        ),
      ).join(',');
    }),
  ].join('\r\n');
}
export function readCsv(text: string): string[][] {
  if (text.length > 2_000_000) throw new Error('CSV is too large (2 MB text limit)');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else cell += char;
    } else if (char === ',' || char === '\r' || char === '\n') {
      row.push(cell);
      cell = '';
      closed = false;
      if (char !== ',') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (char === '\r' && source[i + 1] === '\n') i++;
      }
    } else if (char === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error('Malformed CSV quoting');
      cell += char;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > 10001) throw new Error('Use at most 10000 CSV rows per import');
  return rows;
}
export type CsvPreview = {
  entries: z.infer<typeof entrySchema>[];
  duplicates: number;
  errors: string[];
};
export function previewCsv(
  text: string,
  accounts: Account[],
  existing: StoredExpense[],
): CsvPreview {
  const [headers, ...rows] = readCsv(text);
  if (!headers || headers.join(',') !== CSV_HEADERS.join(','))
    throw new Error(`Use the exported CSV template with these columns: ${CSV_HEADERS.join(',')}`);
  const result: CsvPreview = { entries: [], duplicates: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    try {
      const cells = rows[i]!;
      if (cells.length !== CSV_HEADERS.length)
        throw new Error('Column count differs from the template');
      const record = Object.fromEntries(
        CSV_HEADERS.map((key, index) => [key, unescapeCell(cells[index] ?? '')]),
      );
      const amount = parseAmount(record.amount!, record.currency!);
      if (amount === null) throw new Error('Invalid amount for currency');
      const parsed = entrySchema.parse({
        ...record,
        amount,
        receiptUri: null,
        accountId: record.accountId || null,
        toAccountId: record.toAccountId || null,
        refundOfId: record.refundOfId || null,
        deletedAt: record.deletedAt || null,
      });
      const match = [...existing.map(portableEntry), ...result.entries].find(
        (entry) => entry.id === parsed.id,
      );
      if (match) {
        if (CSV_HEADERS.every((key) => match[key] === parsed[key])) result.duplicates++;
        else throw new Error('ID conflicts with a different transaction');
      } else result.entries.push(parsed);
    } catch (err) {
      result.errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Invalid row'}`);
    }
  }
  const all = [...existing, ...result.entries];
  for (const entry of result.entries) {
    try {
      if (!entry.deletedAt) validateEntry(entry, accounts, all, entry.id);
      else {
        if (
          entry.accountId &&
          !accounts.some(
            (account) => account.id === entry.accountId && account.currency === entry.currency,
          )
        )
          throw new Error('Missing account for historical transaction');
      }
    } catch (err) {
      result.errors.push(
        `${entry.description}: ${err instanceof Error ? err.message : 'Invalid transaction'}`,
      );
    }
  }
  return result;
}
