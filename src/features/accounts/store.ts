import { eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import { accounts, type Account } from './data/schema';
import { budgets, type Budget } from '@/features/budgets/data/schema';
import { getExpenseDatabase } from '@/features/expenses/data/database';
import { personalMutation } from '@/features/expenses/data/mutations';
import { expenses } from '@/features/expenses/data/schema';
import { expenseFormSchema, type ExpenseInput } from '@/features/expenses/domain/expense';
import { validateEntry } from '@/features/expenses/domain/ledger';
import { SUPPORTED_CURRENCIES } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';
import {
  recurringDrafts,
  recurringRules,
  type RecurringDraft,
  type RecurringRule,
} from '@/features/recurrence/data/schema';
import {
  dateInTimeZone,
  dueDrafts,
  withoutRecurringReceipts,
} from '@/features/recurrence/domain/schedule';
import { personalSettings } from '@/features/settings/data/schema';
import {
  changeCategoryRules,
  parseCategoryRules,
  type CategoryRule,
  type CategoryRuleAction,
} from '@/features/settings/domain/category-rules';
import { prepareBulkChange, type BulkAction } from './domain/bulk';
import { validateCarryover } from '@/features/reports/domain/reports';
import { groupCashMovements } from '@/features/group-cash/data/schema';
import { validateMatchedTransaction } from '@/features/group-cash/domain/cash';

type PersonalState = {
  accounts: Account[];
  budgets: Budget[];
  rules: RecurringRule[];
  drafts: RecurringDraft[];
  defaultCurrency: string;
  categories: string[];
  categoryRules: CategoryRule[];
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  saveAccount: (input: Omit<Account, 'id' | 'createdAt'>, id?: string) => Promise<void>;
  saveBudget: (input: Omit<Budget, 'id'>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  bulkChange: (ids: string[], action: BulkAction) => Promise<number>;
  saveSettings: (currency: string, categories: string[]) => Promise<void>;
  changeCategoryRule: (action: CategoryRuleAction) => Promise<void>;
  addRule: (
    entry: ExpenseInput,
    frequency: RecurringRule['frequency'],
    startDate: string,
    interval: number,
    endDate: string | null,
    timeZone: string,
  ) => Promise<void>;
  setRuleActive: (id: string, active: boolean) => Promise<void>;
  generateDue: () => Promise<void>;
  decideDraft: (id: string, approve: boolean) => Promise<void>;
};

export const usePersonalStore = create<PersonalState>((set, get) => ({
  accounts: [],
  budgets: [],
  rules: [],
  drafts: [],
  defaultCurrency: 'INR',
  categories: [],
  categoryRules: [],
  loaded: false,
  error: null,
  load: async () => {
    try {
      const db = await getExpenseDatabase();
      const [accountRows, budgetRows, ruleRows, draftRows, settingsRows] = await Promise.all([
        db.select().from(accounts),
        db.select().from(budgets),
        db.select().from(recurringRules),
        db.select().from(recurringDrafts),
        db.select().from(personalSettings),
      ]);
      const settings = settingsRows.find((row) => row.id === 'personal');
      set({
        accounts: accountRows,
        budgets: budgetRows,
        rules: ruleRows,
        drafts: draftRows,
        defaultCurrency: settings?.defaultCurrency ?? 'INR',
        categories: JSON.parse(settings?.categories ?? '[]') as string[],
        categoryRules: parseCategoryRules(settings?.categoryRules ?? '[]'),
        loaded: true,
        error: null,
      });
    } catch {
      set({ error: 'Could not load personal settings and accounts. Please retry.' });
    }
  },
  saveAccount: (input, id) =>
    personalMutation(async () => {
      if (
        !input.name.trim() ||
        input.name.length > 80 ||
        !SUPPORTED_CURRENCIES.includes(input.currency) ||
        !Number.isSafeInteger(input.openingBalance)
      )
        throw new Error('Enter a name, supported currency and safe opening balance');
      const db = await getExpenseDatabase();
      if (id) {
        const [old] = await db.select().from(accounts).where(eq(accounts.id, id));
        if (!old) throw new Error('Account not found');
        if (
          old.currency !== input.currency &&
          ((await db.select().from(expenses)).some(
            (row) => row.accountId === id || row.toAccountId === id,
          ) ||
            (await db.select().from(groupCashMovements)).some((row) => row.accountId === id))
        )
          throw new Error('Currency cannot change after an account has transactions');
        await db.update(accounts).set(input).where(eq(accounts.id, id));
      } else
        await db.insert(accounts).values({
          ...input,
          name: input.name.trim(),
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        });
      await get().load();
    }),
  saveBudget: (input) =>
    personalMutation(async () => {
      if (
        !input.name.trim() ||
        input.name.length > 80 ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month) ||
        !SUPPORTED_CURRENCIES.includes(input.currency) ||
        !Number.isSafeInteger(input.amount) ||
        input.amount <= 0 ||
        !Number.isInteger(input.threshold) ||
        input.threshold < 1 ||
        input.threshold > 100
      )
        throw new Error('Enter a valid monthly budget and threshold (1–100)');
      if (input.category && !expenseFormSchema.shape.category.safeParse(input.category).success)
        throw new Error('Choose a valid budget category');
      if (input.tag && input.tag.length > 40)
        throw new Error('Budget tags must be at most 40 characters');
      if (input.basis && input.basis !== 'personal' && input.basis !== 'combined')
        throw new Error('Choose a valid budget basis');
      if (input.basis === 'combined' && (input.accountId || input.tag))
        throw new Error('Combined budgets cannot filter by account or tag');
      const db = await getExpenseDatabase();
      if (
        input.accountId &&
        !(await db.select().from(accounts)).some(
          (row) => row.id === input.accountId && row.currency === input.currency,
        )
      )
        throw new Error('Choose a matching-currency account');
      const row = { ...input, id: randomUUID() };
      validateCarryover(row, await db.select().from(budgets));
      await db.insert(budgets).values(row);
      await get().load();
    }),
  deleteBudget: (id) =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      if ((await db.select().from(budgets)).some((budget) => budget.carryoverFromId === id))
        throw new Error('Remove the dependent carryover budget first');
      await db.delete(budgets).where(eq(budgets.id, id));
      await get().load();
    }),
  bulkChange: (ids, action) =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      const changes = prepareBulkChange(
        await db.select().from(expenses),
        ids,
        action,
        await db.select().from(accounts),
        new Date().toISOString(),
      );
      const cashMovements = await db.select().from(groupCashMovements);
      for (const row of changes) validateMatchedTransaction(row, cashMovements);
      db.transaction((tx) => {
        for (const row of changes)
          tx.update(expenses)
            .set({
              category: row.category,
              tags: row.tags,
              deletedAt: row.deletedAt,
              updatedAt: row.updatedAt,
            })
            .where(eq(expenses.id, row.id))
            .run();
      });
      await useExpensesStore.getState().loadExpenses();
      return changes.length;
    }),
  saveSettings: (currency, categories) =>
    personalMutation(async () => {
      if (!SUPPORTED_CURRENCIES.includes(currency))
        throw new Error('Choose a supported ISO currency');
      const cleaned = [...new Set(categories.map((item) => item.trim()).filter(Boolean))];
      if (cleaned.length > 50 || cleaned.some((item) => item.length > 40))
        throw new Error('Use up to 50 category names, each at most 40 characters');
      const db = await getExpenseDatabase();
      await db
        .insert(personalSettings)
        .values({ id: 'personal', defaultCurrency: currency, categories: JSON.stringify(cleaned) })
        .onConflictDoUpdate({
          target: personalSettings.id,
          set: { defaultCurrency: currency, categories: JSON.stringify(cleaned) },
        });
      await get().load();
    }),
  changeCategoryRule: (action) =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      const rows = await db.select().from(personalSettings);
      const current = rows.find((row) => row.id === 'personal');
      const rules = changeCategoryRules(
        parseCategoryRules(current?.categoryRules ?? '[]'),
        action,
        randomUUID(),
      );
      await db
        .insert(personalSettings)
        .values({ id: 'personal', categoryRules: JSON.stringify(rules) })
        .onConflictDoUpdate({
          target: personalSettings.id,
          set: { categoryRules: JSON.stringify(rules) },
        });
      await get().load();
    }),
  addRule: (entry, frequency, startDate, interval, endDate, timeZone) =>
    personalMutation(async () => {
      if (
        !['daily', 'weekly', 'monthly', 'yearly'].includes(frequency) ||
        !Number.isInteger(interval) ||
        interval < 1 ||
        interval > 365
      )
        throw new Error('Choose a valid recurrence and interval');
      if ((entry.entryType ?? 'expense') === 'refund')
        throw new Error('Refunds must be entered explicitly, not repeated automatically');
      if (
        endDate &&
        (!expenseFormSchema.shape.date.safeParse(endDate).success || endDate < startDate)
      )
        throw new Error('Enter an end date on or after the first due date');
      if (!timeZone.trim()) throw new Error('Enter a schedule time zone');
      dateInTimeZone(new Date(), timeZone);
      const db = await getExpenseDatabase();
      validateEntry(
        { ...entry, date: startDate },
        await db.select().from(accounts),
        await db.select().from(expenses),
      );
      await db.insert(recurringRules).values({
        id: randomUUID(),
        name: entry.description,
        template: JSON.stringify(withoutRecurringReceipts(entry)),
        frequency,
        startDate,
        nextDate: startDate,
        endDate,
        timeZone,
        interval,
        active: true,
      });
      await get().load();
    }),
  setRuleActive: (id, active) =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      await db.update(recurringRules).set({ active }).where(eq(recurringRules.id, id));
      await get().load();
    }),
  generateDue: () =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      const rules = await db.select().from(recurringRules);
      const existing = await db.select().from(recurringDrafts);
      const now = new Date();
      db.transaction((tx) => {
        for (const rule of rules) {
          const result = dueDrafts(rule, dateInTimeZone(now, rule.timeZone), existing);
          for (const draft of result.drafts)
            tx.insert(recurringDrafts).values(draft).onConflictDoNothing().run();
          if (result.nextDate !== rule.nextDate)
            tx.update(recurringRules)
              .set({ nextDate: result.nextDate })
              .where(eq(recurringRules.id, rule.id))
              .run();
        }
      });
      await get().load();
    }),
  decideDraft: (id, approve) =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      const [draft] = await db.select().from(recurringDrafts).where(eq(recurringDrafts.id, id));
      if (!draft || draft.status !== 'pending')
        throw new Error('Draft already processed or missing');
      const input = withoutRecurringReceipts({
        ...(JSON.parse(draft.template) as ExpenseInput),
        date: draft.date,
      });
      if (approve)
        validateEntry(input, await db.select().from(accounts), await db.select().from(expenses));
      const now = new Date().toISOString();
      db.transaction((tx) => {
        if (approve)
          tx.insert(expenses)
            .values({ ...input, id: `recurring:${draft.id}`, createdAt: now, updatedAt: now })
            .run();
        tx.update(recurringDrafts)
          .set({ status: approve ? 'approved' : 'skipped' })
          .where(eq(recurringDrafts.id, id))
          .run();
      });
      await Promise.all([get().load(), useExpensesStore.getState().loadExpenses()]);
    }),
}));
