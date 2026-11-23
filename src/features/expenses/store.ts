import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import { getExpenseDatabase } from './data/database';
import { deleteReceiptFile } from './data/receipt-files';
import { expenses, type StoredExpense } from './data/schema';
import type { ExpenseInput } from './domain/expense';

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error';

type ExpensesState = {
  expenses: StoredExpense[];
  status: StoreStatus;
  error: string | null;
  loadExpenses: () => Promise<void>;
  saveExpense: (input: ExpenseInput, id?: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong while saving your expenses.';
}

export const useExpensesStore = create<ExpensesState>((set) => ({
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
    } catch (error) {
      console.error('Could not load expenses', error);
      set({ status: 'error', error: `Could not load expenses: ${errorMessage(error)}` });
    }
  },

  saveExpense: async (input, id) => {
    const now = new Date().toISOString();
    try {
      const db = await getExpenseDatabase();
      if (id) {
        await db
          .update(expenses)
          .set({ ...input, updatedAt: now })
          .where(eq(expenses.id, id));
      } else {
        await db.insert(expenses).values({
          ...input,
          id: randomUUID(),
          createdAt: now,
          updatedAt: now,
        });
      }
      const rows = await db
        .select()
        .from(expenses)
        .orderBy(desc(expenses.date), desc(expenses.createdAt));
      set({ expenses: rows, status: 'ready', error: null });
    } catch (error) {
      const message = `Could not save expense: ${errorMessage(error)}`;
      console.error(message, error);
      set({ error: message });
      throw new Error(message, { cause: error });
    }
  },

  deleteExpense: async (id) => {
    try {
      const db = await getExpenseDatabase();
      const [expense] = await db
        .select({ receiptUri: expenses.receiptUri })
        .from(expenses)
        .where(eq(expenses.id, id));
      await db.delete(expenses).where(eq(expenses.id, id));
      const rows = await db
        .select()
        .from(expenses)
        .orderBy(desc(expenses.date), desc(expenses.createdAt));
      set({ expenses: rows, status: 'ready', error: null });
      if (expense?.receiptUri) {
        try {
          deleteReceiptFile(expense.receiptUri);
        } catch (error) {
          console.warn('Expense deleted, but its receipt photo could not be removed.', error);
        }
      }
    } catch (error) {
      const message = `Could not delete expense: ${errorMessage(error)}`;
      console.error(message, error);
      set({ error: message });
      throw new Error(message, { cause: error });
    }
  },
}));
