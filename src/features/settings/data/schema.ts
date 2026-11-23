import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const personalSettings = sqliteTable('personal_settings', {
  id: text('id').primaryKey(),
  defaultCurrency: text('default_currency').notNull().default('INR'),
  categories: text('categories').notNull().default('[]'),
  categoryRules: text('category_rules').notNull().default('[]'),
});
export type PersonalSettings = typeof personalSettings.$inferSelect;
