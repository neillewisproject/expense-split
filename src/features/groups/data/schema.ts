import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

import type { GroupExpense, GroupExpenseKind, GroupLedger, SplitInputs } from '../domain/group';

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  syncUserId: text('sync_user_id'),
  syncStatus: text('sync_status')
    .$type<'local' | 'pending' | 'synced' | 'conflict'>()
    .notNull()
    .default('local'),
  inviteCode: text('invite_code'),
  inviteExpiresAt: text('invite_expires_at'),
  currency: text('currency').notNull().default('INR'),
  ownerId: text('owner_id'),
  revision: integer('revision').notNull().default(0),
  localRevision: integer('local_revision').notNull().default(0),
  archivedAt: text('archived_at'),
  meMemberId: text('me_member_id'),
  conflictMessage: text('conflict_message'),
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
    deactivatedAt: text('deactivated_at'),
    userId: text('user_id'),
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
    currency: text('currency').notNull().default('INR'),
    contributions: text('contributions', { mode: 'json' }).$type<Record<string, number>>(),
    splitInputs: text('split_inputs', { mode: 'json' }).$type<SplitInputs>(),
    category: text('category').notNull().default('other'),
    notes: text('notes').notNull().default(''),
    method: text('method').notNull().default(''),
    reference: text('reference').notNull().default(''),
    authorId: text('author_id'),
    updatedAt: text('updated_at').notNull().default(''),
    revision: integer('revision').notNull().default(0),
    deletedAt: text('deleted_at'),
    itemized: text('itemized', { mode: 'json' }).$type<GroupExpense['itemized']>(),
    conversion: text('conversion', { mode: 'json' }).$type<GroupExpense['conversion']>(),
    refundOfId: text('refund_of_id'),
    refundSnapshot: text('refund_snapshot', { mode: 'json' }).$type<
      GroupExpense['refundSnapshot']
    >(),
    receipts: text('receipts', { mode: 'json' })
      .$type<Record<string, string[]>>()
      .notNull()
      .default(sql`'[]'`),
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

export const groupOperations = sqliteTable(
  'group_operations',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    baseRevision: integer('base_revision').notNull(),
    localRevision: integer('local_revision').notNull(),
    snapshot: text('snapshot', { mode: 'json' }).$type<GroupLedger>().notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('group_operations_order_idx').on(table.userId, table.groupId, table.localRevision),
  ],
);

export const groupActivity = sqliteTable(
  'group_activity',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    expenseId: text('expense_id'),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    text: text('text').notNull().default(''),
    details: text('details').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('group_activity_group_idx').on(table.groupId)],
);

export const groupAccessTombstones = sqliteTable(
  'group_access_tombstones',
  {
    groupId: text('group_id').notNull(),
    userId: text('user_id').notNull(),
    revision: integer('revision').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.userId] })],
);
