import { eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { accounts } from '@/features/accounts/data/schema';
import { getExpenseDatabase } from '@/features/expenses/data/database';
import { personalMutation } from '@/features/expenses/data/mutations';
import { expenses } from '@/features/expenses/data/schema';
import {
  goalContributions,
  savingsGoals,
  type GoalContribution,
  type SavingsGoal,
} from './data/schema';
import { validateContribution, validateGoal } from './domain/goals';
import { groupCashMovements } from '@/features/group-cash/data/schema';
import { localDate } from '@/features/expenses/domain/expense';

type GoalsState = {
  goals: SavingsGoal[];
  contributions: GoalContribution[];
  error: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  saveGoal: (
    input: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ) => Promise<void>;
  contribute: (
    goalId: string,
    input: Pick<GoalContribution, 'amount' | 'date' | 'note'>,
  ) => Promise<void>;
};
export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  contributions: [],
  error: null,
  loaded: false,
  load: async () => {
    try {
      const db = await getExpenseDatabase();
      const [goals, contributions] = await Promise.all([
        db.select().from(savingsGoals),
        db.select().from(goalContributions),
      ]);
      set({ goals, contributions, error: null, loaded: true });
    } catch {
      set({ error: 'Could not load savings goals. Retry after database initialization.' });
    }
  },
  saveGoal: (input, id) =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      validateGoal(input, await db.select().from(accounts));
      const now = new Date().toISOString();
      if (id) {
        const [old] = await db.select().from(savingsGoals).where(eq(savingsGoals.id, id));
        if (!old) throw new Error('Goal not found');
        if (old.accountId !== input.accountId || old.currency !== input.currency)
          throw new Error(
            'A saved goal’s account and currency cannot change; create a new goal instead',
          );
        await db
          .update(savingsGoals)
          .set({ ...input, name: input.name.trim(), updatedAt: now })
          .where(eq(savingsGoals.id, id));
      } else
        await db.insert(savingsGoals).values({
          ...input,
          name: input.name.trim(),
          id: randomUUID(),
          createdAt: now,
          updatedAt: now,
        });
      await get().load();
    }),
  contribute: (goalId, input) =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      const goalRows = await db.select().from(savingsGoals);
      const goal = goalRows.find((row) => row.id === goalId);
      if (!goal) throw new Error('Goal not found');
      validateContribution(
        goal,
        input,
        await db.select().from(accounts),
        goalRows,
        await db.select().from(goalContributions),
        await db.select().from(expenses),
        localDate(),
        await db.select().from(groupCashMovements),
      );
      await db
        .insert(goalContributions)
        .values({ ...input, goalId, id: randomUUID(), createdAt: new Date().toISOString() });
      await get().load();
    }),
}));
