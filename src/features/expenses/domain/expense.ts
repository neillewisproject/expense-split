import { z } from 'zod';

import { parseAmount, SUPPORTED_CURRENCIES } from './money';

export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'bills',
  'entertainment',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number] | `custom:${string}`;

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  transport: 'Transport',
  shopping: 'Shopping',
  bills: 'Bills',
  entertainment: 'Entertainment',
  other: 'Other',
};

export const expenseFormSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, 'Enter a description')
      .max(80, 'Use 80 characters or fewer'),
    amount: z.string().trim(),
    category: z
      .string()
      .refine(
        (value) =>
          EXPENSE_CATEGORIES.includes(value as (typeof EXPENSE_CATEGORIES)[number]) ||
          /^custom:.{1,40}$/.test(value),
        'Choose a category',
      )
      .transform((value) => value as ExpenseCategory),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .refine((value) => {
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
      }, 'Enter a valid calendar date'),
    currency: z
      .string()
      .refine((value) => SUPPORTED_CURRENCIES.includes(value), 'Choose a supported ISO currency')
      .optional(),
    entryType: z.enum(['expense', 'income', 'refund', 'transfer']).optional(),
    accountId: z.string().optional(),
    toAccountId: z.string().optional(),
    refundOfId: z.string().optional(),
    notes: z.string().max(2000).optional(),
    tags: z.string().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.currency && !SUPPORTED_CURRENCIES.includes(value.currency)) return;
    const amount = parseAmount(value.amount, value.currency ?? 'INR');
    if (amount === null || amount <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message:
          value.currency && value.currency !== 'INR'
            ? `Enter an amount greater than zero valid for ${value.currency}`
            : 'Enter an amount greater than zero with up to 2 decimal places',
      });
    }
    if (
      value.entryType === 'transfer' &&
      (!value.accountId || !value.toAccountId || value.accountId === value.toAccountId)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['toAccountId'],
        message: 'Choose two different accounts for a transfer',
      });
    }
    if (value.entryType === 'refund' && !value.refundOfId) {
      ctx.addIssue({
        code: 'custom',
        path: ['refundOfId'],
        message: 'Link the original expense for this refund',
      });
    }
  });

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
export type ExpenseFormRawValues = z.input<typeof expenseFormSchema>;

export type ExpenseInput = {
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  receiptUri: string | null;
  receiptUris?: string;
  currency?: string;
  entryType?: 'expense' | 'income' | 'refund' | 'transfer';
  accountId?: string | null;
  toAccountId?: string | null;
  refundOfId?: string | null;
  notes?: string;
  tags?: string;
};

export function categoryLabel(category: string): string {
  return EXPENSE_CATEGORY_LABELS[category] ?? category.replace(/^custom:/, '');
}

export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function parseTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

export function getReceiptUris(entry: Pick<ExpenseInput, 'receiptUri' | 'receiptUris'>): string[] {
  let value: unknown;
  try {
    value = JSON.parse(entry.receiptUris ?? '[]');
  } catch {
    throw new Error('Receipt metadata is invalid');
  }
  const result = z.array(z.string().min(1).max(4000)).max(10).safeParse(value);
  if (!result.success) throw new Error('Use at most ten valid receipt photos per entry');
  const uris = [...new Set([...(entry.receiptUri ? [entry.receiptUri] : []), ...result.data])];
  if (uris.length > 10) throw new Error('Use at most ten receipt photos per entry');
  return uris;
}
