import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { ExpenseCategory } from '../domain/expense';

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  category: text('category').$type<ExpenseCategory>().notNull(),
  date: text('date').notNull(),
  receiptUri: text('receipt_uri'),
  receiptUris: text('receipt_uris').notNull().default('[]'),
  currency: text('currency').notNull().default('INR'),
  entryType: text('entry_type')
    .$type<'expense' | 'income' | 'refund' | 'transfer'>()
    .notNull()
    .default('expense'),
  accountId: text('account_id'),
  toAccountId: text('to_account_id'),
  refundOfId: text('refund_of_id'),
  notes: text('notes').notNull().default(''),
  tags: text('tags').notNull().default('[]'),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

type ExpenseRow = typeof expenses.$inferSelect;
type PersonalFields =
  | 'receiptUris'
  | 'currency'
  | 'entryType'
  | 'accountId'
  | 'toAccountId'
  | 'refundOfId'
  | 'notes'
  | 'tags'
  | 'deletedAt';
export type StoredExpense = Omit<ExpenseRow, PersonalFields> &
  Partial<Pick<ExpenseRow, PersonalFields>>;
