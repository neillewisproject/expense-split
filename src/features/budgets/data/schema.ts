import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const budgets = sqliteTable('personal_budgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  month: text('month').notNull(),
  currency: text('currency').notNull().default('INR'),
  amount: integer('amount').notNull(),
  category: text('category'),
  accountId: text('account_id'),
  tag: text('tag'),
  threshold: integer('threshold').notNull().default(80),
  carryoverFromId: text('carryover_from_id'),
  basis: text('basis').$type<'personal' | 'combined'>().notNull().default('personal'),
});
type BudgetRow = typeof budgets.$inferSelect;
export type Budget = Omit<BudgetRow, 'carryoverFromId' | 'basis'> &
  Partial<Pick<BudgetRow, 'carryoverFromId' | 'basis'>>;
