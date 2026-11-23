import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const recurringRules = sqliteTable('personal_recurring_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  template: text('template').notNull(),
  startDate: text('start_date').notNull(),
  frequency: text('frequency').$type<'daily' | 'weekly' | 'monthly' | 'yearly'>().notNull(),
  interval: integer('interval').notNull().default(1),
  nextDate: text('next_date').notNull(),
  endDate: text('end_date'),
  timeZone: text('time_zone'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});
export const recurringDrafts = sqliteTable('personal_recurring_drafts', {
  id: text('id').primaryKey(),
  ruleId: text('rule_id').notNull(),
  date: text('date').notNull(),
  template: text('template').notNull(),
  status: text('status').$type<'pending' | 'approved' | 'skipped'>().notNull().default('pending'),
});
export type RecurringRule = typeof recurringRules.$inferSelect;
export type RecurringDraft = typeof recurringDrafts.$inferSelect;
