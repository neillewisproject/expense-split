import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const groupCashMovements = sqliteTable('personal_group_cash_movements', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  expenseId: text('expense_id').notNull(),
  memberId: text('member_id').notNull(),
  groupUserId: text('group_user_id'),
  accountId: text('account_id').notNull(),
  personalEntryId: text('personal_entry_id'),
  currency: text('currency').notNull(),
  amount: integer('amount').notNull(),
  direction: text('direction').$type<'in' | 'out'>().notNull(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  groupName: text('group_name').notNull(),
  expenseRevision: integer('expense_revision').notNull(),
  createdAt: text('created_at').notNull(),
  voidedAt: text('voided_at'),
});

export type GroupCashMovement = typeof groupCashMovements.$inferSelect;
