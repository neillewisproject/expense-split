import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const savingsGoals = sqliteTable('personal_savings_goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  accountId: text('account_id').notNull(),
  currency: text('currency').notNull(),
  target: integer('target').notNull(),
  targetDate: text('target_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const goalContributions = sqliteTable('personal_goal_contributions', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull(),
  amount: integer('amount').notNull(),
  date: text('date').notNull(),
  note: text('note').notNull().default(''),
  createdAt: text('created_at').notNull(),
});
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type GoalContribution = typeof goalContributions.$inferSelect;
