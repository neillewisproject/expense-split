import { z } from 'zod';

import { parseAmount } from './money';

export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'bills',
  'entertainment',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: 'Food',
  transport: 'Transport',
  shopping: 'Shopping',
  bills: 'Bills',
  entertainment: 'Entertainment',
  other: 'Other',
};

export const expenseFormSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Enter a description')
    .max(80, 'Use 80 characters or fewer'),
  amount: z
    .string()
    .trim()
    .refine((value) => {
      const amount = parseAmount(value);
      return amount !== null && Number.isSafeInteger(amount) && amount > 0;
    }, 'Enter an amount greater than zero with up to 2 decimal places'),
  category: z.enum(EXPENSE_CATEGORIES),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((value) => {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }, 'Enter a valid calendar date'),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export type ExpenseInput = {
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  receiptUri: string | null;
};
