import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { ExpenseCategory } from '../domain/expense';

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  category: text('category').$type<ExpenseCategory>().notNull(),
  date: text('date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type StoredExpense = typeof expenses.$inferSelect;
