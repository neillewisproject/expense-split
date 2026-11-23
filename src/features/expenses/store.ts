import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import { accounts } from '@/features/accounts/data/schema';
import { groupCashMovements } from '@/features/group-cash/data/schema';
import { validateMatchedTransaction } from '@/features/group-cash/domain/cash';
import { getExpenseDatabase } from './data/database';
import { personalMutation } from './data/mutations';
import { expenses, type StoredExpense } from './data/schema';
import { getReceiptUris, type ExpenseInput } from './domain/expense';
import { validateEntry } from './domain/ledger';

type ExpensesState = {
  expenses: StoredExpense[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  loadExpenses: () => Promise<void>;
  saveExpense: (input: ExpenseInput, id?: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  restoreExpense: (id: string) => Promise<void>;
  duplicateExpense: (id: string) => Promise<void>;
};

export const useExpensesStore = create<ExpensesState>((set, get) => ({
  expenses: [],
  status: 'idle',
  error: null,
  loadExpenses: async () => {
    set({ status: 'loading', error: null });
    try {
      const db = await getExpenseDatabase();
      const rows = await db
        .select()
        .from(expenses)
        .orderBy(desc(expenses.date), desc(expenses.createdAt));
      set({ expenses: rows, status: 'ready', error: null });
    } catch {
      set({
        status: 'error',
        error: 'Could not load personal transactions. Retry after database initialization.',
      });
    }
  },
  saveExpense: (input, id) =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      const now = new Date().toISOString();
      const rows = await db.select().from(expenses);
      if (id && !rows.some((item) => item.id === id && !item.deletedAt))
        throw new Error('Transaction not found or in trash');
      validateEntry(input, await db.select().from(accounts), rows, id);
      const normalized = {
        ...input,
        receiptUris: JSON.stringify(getReceiptUris(input)),
        currency: input.currency ?? 'INR',
        entryType: input.entryType ?? 'expense',
        accountId: input.accountId || null,
        toAccountId: input.toAccountId || null,
        refundOfId: input.refundOfId || null,
        notes: input.notes ?? '',
        tags: input.tags ?? '[]',
        updatedAt: now,
      };
      if (id) {
        const old = rows.find((item) => item.id === id);
        if (!old) throw new Error('Transaction not found');
        validateMatchedTransaction(
          { ...old, ...normalized },
          await db.select().from(groupCashMovements),
        );
        await db.update(expenses).set(normalized).where(eq(expenses.id, id));
      } else await db.insert(expenses).values({ ...normalized, id: randomUUID(), createdAt: now });
      await get().loadExpenses();
    }),
  deleteExpense: (id) =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      const rows = await db.select().from(expenses);
      const entry = rows.find((row) => row.id === id && !row.deletedAt);
      if (!entry) throw new Error('Transaction not found');
      if (rows.some((row) => !row.deletedAt && row.refundOfId === id))
        throw new Error('Move linked refunds to trash before their original expense');
      const now = new Date().toISOString();
      validateMatchedTransaction(
        { ...entry, deletedAt: now },
        await db.select().from(groupCashMovements),
      );
      await db.update(expenses).set({ deletedAt: now, updatedAt: now }).where(eq(expenses.id, id));
      await get().loadExpenses();
    }),
  restoreExpense: (id) =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      const rows = await db.select().from(expenses);
      const entry = rows.find((row) => row.id === id && row.deletedAt);
      if (!entry) throw new Error('Transaction not found in trash');
      validateEntry(entry, await db.select().from(accounts), rows, id);
      await db
        .update(expenses)
        .set({ deletedAt: null, updatedAt: new Date().toISOString() })
        .where(eq(expenses.id, id));
      await get().loadExpenses();
    }),
  duplicateExpense: async (id) => {
    const entry = get().expenses.find((item) => item.id === id && !item.deletedAt);
    if (!entry) throw new Error('Transaction not found');
    if (entry.entryType === 'refund')
      throw new Error('Create a linked refund explicitly instead of duplicating one');
    await get().saveExpense({ ...entry, receiptUri: null, receiptUris: '[]' });
  },
}));
