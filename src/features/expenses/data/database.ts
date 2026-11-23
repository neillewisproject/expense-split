import * as SQLite from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import migrations from '../../../../drizzle/migrations';
import * as expenseSchema from './schema';
import * as groupSchema from '@/features/groups/data/schema';
import * as accountSchema from '@/features/accounts/data/schema';
import * as budgetSchema from '@/features/budgets/data/schema';
import * as recurrenceSchema from '@/features/recurrence/data/schema';
import * as settingsSchema from '@/features/settings/data/schema';
import * as goalsSchema from '@/features/goals/data/schema';
import * as groupCashSchema from '@/features/group-cash/data/schema';

const schema = {
  ...expenseSchema,
  ...groupSchema,
  ...accountSchema,
  ...budgetSchema,
  ...recurrenceSchema,
  ...settingsSchema,
  ...goalsSchema,
  ...groupCashSchema,
};

export type ExpenseDatabase = ExpoSQLiteDatabase<typeof schema>;

let databasePromise: Promise<ExpenseDatabase> | null = null;

async function initializeDatabase(): Promise<ExpenseDatabase> {
  const sqlite = SQLite.openDatabaseSync('expense-split.db');
  sqlite.execSync('PRAGMA foreign_keys = ON;');
  const db = drizzle(sqlite, { schema });
  await migrate(db, migrations);
  return db;
}

export function getExpenseDatabase(): Promise<ExpenseDatabase> {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}
