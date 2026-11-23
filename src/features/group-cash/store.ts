import { eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import { accounts } from '@/features/accounts/data/schema';
import { getExpenseDatabase } from '@/features/expenses/data/database';
import { personalMutation } from '@/features/expenses/data/mutations';
import { expenses } from '@/features/expenses/data/schema';
import { readGroups } from '@/features/groups/data/local-ledger';
import { withGroupLock } from '@/features/groups/data/group-lock';
import { useGroupsStore } from '@/features/groups/store';
import { groupCashMovements, type GroupCashMovement } from './data/schema';
import { groupCashOption, validateCashMatch, validateCashMovement } from './domain/cash';

type State = {
  movements: GroupCashMovement[];
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  record: (
    expected: ReturnType<typeof groupCashOption>,
    accountId: string,
    expectedUser: string | null,
    personalEntryId?: string | null,
  ) => Promise<void>;
  voidMovement: (id: string) => Promise<void>;
};

export const useGroupCashStore = create<State>((set, get) => ({
  movements: [],
  loaded: false,
  error: null,
  load: async () => {
    try {
      const db = await getExpenseDatabase();
      const movements = await db.select().from(groupCashMovements);
      set({ movements, loaded: true, error: null });
    } catch {
      set({ error: 'Could not load group cash movements. Retry before using account balances.' });
    }
  },
  record: (expected, accountId, expectedUser, personalEntryId = null) =>
    personalMutation(() =>
      withGroupLock(expected.groupId, async () => {
        if (useGroupsStore.getState().activeUserId !== expectedUser)
          throw new Error('Your account changed. Reopen this group');
        const group = (await readGroups(expectedUser ?? undefined)).find(
          (item) => item.id === expected.groupId,
        );
        const expense = group?.expenses.find((item) => item.id === expected.expenseId);
        if (!group || !expense) throw new Error('The group entry is no longer available');
        const input = groupCashOption(group, expense, expectedUser);
        if (JSON.stringify(input) !== JSON.stringify(expected))
          throw new Error('The group entry changed. Reopen it and review the movement again');
        const db = await getExpenseDatabase();
        const [accountRows, movements] = await Promise.all([
          db.select().from(accounts),
          db.select().from(groupCashMovements),
        ]);
        validateCashMovement(
          input,
          accountRows.find((account) => account.id === accountId),
          movements,
        );
        if (personalEntryId) {
          const entries = await db.select().from(expenses);
          validateCashMatch(
            { ...input, accountId },
            entries.find((entry) => entry.id === personalEntryId),
            movements,
          );
        }
        if (useGroupsStore.getState().activeUserId !== expectedUser)
          throw new Error('Your account changed. Reopen this group');
        db.transaction((tx) => {
          tx.insert(groupCashMovements)
            .values({
              ...input,
              id: randomUUID(),
              accountId,
              personalEntryId,
              createdAt: new Date().toISOString(),
              voidedAt: null,
            })
            .run();
        });
        await get().load();
      }),
    ),
  voidMovement: (id) =>
    personalMutation(async () => {
      const db = await getExpenseDatabase();
      const [movement] = await db
        .select()
        .from(groupCashMovements)
        .where(eq(groupCashMovements.id, id));
      if (!movement || movement.voidedAt) throw new Error('Movement not found or already voided');
      await db
        .update(groupCashMovements)
        .set({ voidedAt: new Date().toISOString() })
        .where(eq(groupCashMovements.id, id));
      await get().load();
    }),
}));
