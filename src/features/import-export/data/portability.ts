import { getExpenseDatabase } from '@/features/expenses/data/database';
import { personalMutation } from '@/features/expenses/data/mutations';
import { deleteReceiptFile } from '@/features/expenses/data/receipt-files';
import { expenses } from '@/features/expenses/data/schema';
import { accounts } from '@/features/accounts/data/schema';
import { usePersonalStore } from '@/features/accounts/store';
import { budgets } from '@/features/budgets/data/schema';
import { recurringDrafts, recurringRules } from '@/features/recurrence/data/schema';
import { personalSettings } from '@/features/settings/data/schema';
import { parseCategoryRules } from '@/features/settings/domain/category-rules';
import { useExpensesStore } from '@/features/expenses/store';
import { groupCashMovements } from '@/features/group-cash/data/schema';
import { useGroupCashStore } from '@/features/group-cash/store';
import { getReceiptUris } from '@/features/expenses/domain/expense';
import { cancelAllPersonalReminders } from '@/features/recurrence/data/reminder-state';
import {
  exportCsv,
  portableEntry,
  portableTemplate,
  previewBackup,
  previewCsv,
} from '../domain/portability';

export async function createBackup(): Promise<string> {
  return personalMutation(async () => {
    const db = await getExpenseDatabase();
    const [entries, accountRows, budgetRows, rules, drafts, settings, cashMovements] =
      await Promise.all([
        db.select().from(expenses),
        db.select().from(accounts),
        db.select().from(budgets),
        db.select().from(recurringRules),
        db.select().from(recurringDrafts),
        db.select().from(personalSettings),
        db.select().from(groupCashMovements),
      ]);
    const preferences = settings.find((row) => row.id === 'personal');
    return JSON.stringify(
      {
        format: 'expense-split-personal',
        version: 8,
        exportedAt: new Date().toISOString(),
        omittedReceiptCount: entries.reduce(
          (count, entry) => count + getReceiptUris(entry).length,
          0,
        ),
        accounts: accountRows,
        expenses: entries.map(portableEntry),
        budgets: budgetRows,
        rules: rules.map((rule) => ({ ...rule, template: portableTemplate(rule.template) })),
        drafts: drafts.map((draft) => ({ ...draft, template: portableTemplate(draft.template) })),
        cashMovements: cashMovements.map(({ groupUserId: _groupUserId, ...movement }) => movement),
        settings: {
          defaultCurrency: preferences?.defaultCurrency ?? 'INR',
          categories: JSON.parse(preferences?.categories ?? '[]') as string[],
          categoryRules: parseCategoryRules(preferences?.categoryRules ?? '[]'),
        },
      },
      null,
      2,
    );
  });
}
export async function createCsv(): Promise<string> {
  const db = await getExpenseDatabase();
  return exportCsv(await db.select().from(expenses));
}
export async function importCsv(text: string): Promise<number> {
  return personalMutation(async () => {
    const db = await getExpenseDatabase();
    const preview = previewCsv(
      text,
      await db.select().from(accounts),
      await db.select().from(expenses),
    );
    if (preview.errors.length)
      throw new Error('Import contains errors. Fix all rows and preview again.');
    db.transaction((tx) => {
      for (const entry of preview.entries) tx.insert(expenses).values(entry).run();
    });
    await useExpensesStore.getState().loadExpenses();
    return preview.entries.length;
  });
}
export async function restoreBackup(text: string, beforeCommit?: () => void): Promise<void> {
  return personalMutation(async () => {
    const backup = previewBackup(text);
    const db = await getExpenseDatabase();
    const existing = await db.select().from(expenses);
    const receiptMap = new Map(existing.map((entry) => [entry.id, getReceiptUris(entry)]));
    await cancelAllPersonalReminders();
    beforeCommit?.();
    db.transaction((tx) => {
      tx.delete(recurringDrafts).run();
      tx.delete(recurringRules).run();
      tx.delete(budgets).run();
      tx.delete(groupCashMovements).run();
      tx.delete(expenses).run();
      tx.delete(accounts).run();
      tx.delete(personalSettings).run();
      for (const row of backup.accounts) tx.insert(accounts).values(row).run();
      for (const row of backup.expenses) {
        const uris = receiptMap.get(row.id) ?? [];
        tx.insert(expenses)
          .values({ ...row, receiptUri: uris[0] ?? null, receiptUris: JSON.stringify(uris) })
          .run();
      }
      for (const row of backup.budgets) tx.insert(budgets).values(row).run();
      for (const row of backup.cashMovements)
        tx.insert(groupCashMovements)
          .values({ ...row, groupUserId: null })
          .run();
      for (const row of backup.rules) tx.insert(recurringRules).values(row).run();
      for (const row of backup.drafts) tx.insert(recurringDrafts).values(row).run();
      tx.insert(personalSettings)
        .values({
          id: 'personal',
          defaultCurrency: backup.settings.defaultCurrency,
          categories: JSON.stringify(backup.settings.categories),
          categoryRules: JSON.stringify(backup.settings.categoryRules),
        })
        .run();
    });
    await Promise.all([
      useExpensesStore.getState().loadExpenses(),
      usePersonalStore.getState().load(),
      useGroupCashStore.getState().load(),
    ]);
    const retainedUris = new Set(
      backup.expenses.flatMap((entry) => receiptMap.get(entry.id) ?? []),
    );
    let cleanupFailed = false;
    for (const uri of new Set(existing.flatMap(getReceiptUris))) {
      if (!retainedUris.has(uri)) {
        try {
          deleteReceiptFile(uri);
        } catch {
          cleanupFailed = true;
        }
      }
    }
    if (cleanupFailed)
      throw new Error(
        'Financial records were restored, but some old receipt files could not be removed',
      );
  });
}
