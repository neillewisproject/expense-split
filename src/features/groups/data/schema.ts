import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { GroupExpenseKind } from '../domain/group';

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  syncUserId: text('sync_user_id'),
  syncStatus: text('sync_status')
    .$type<'local' | 'pending' | 'synced'>()
    .notNull()
    .default('local'),
  inviteCode: text('invite_code'),
});

export const groupMembers = sqliteTable(
  'group_members',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('group_members_group_id_idx').on(table.groupId)],
);

export const groupExpenses = sqliteTable(
  'group_expenses',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    amount: integer('amount').notNull(),
    paidByMemberId: text('paid_by_member_id')
      .notNull()
      .references(() => groupMembers.id),
    date: text('date').notNull(),
    kind: text('kind').$type<GroupExpenseKind>().notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('group_expenses_group_id_idx').on(table.groupId)],
);

export const expenseSplits = sqliteTable(
  'expense_splits',
  {
    expenseId: text('expense_id')
      .notNull()
      .references(() => groupExpenses.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => groupMembers.id),
    amount: integer('amount').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.expenseId, table.memberId] }),
    index('expense_splits_member_id_idx').on(table.memberId),
  ],
);

export type StoredGroup = typeof groups.$inferSelect;
export type StoredGroupMember = typeof groupMembers.$inferSelect;
export type StoredGroupExpense = typeof groupExpenses.$inferSelect;
export type StoredExpenseSplit = typeof expenseSplits.$inferSelect;
