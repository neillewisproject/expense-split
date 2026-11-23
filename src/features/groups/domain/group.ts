import type { Expense } from '@/features/expenses/domain/balances';

export type GroupExpenseKind = 'expense' | 'settlement';

export type GroupExpense = Expense & {
  date: string;
  kind: GroupExpenseKind;
};

export type GroupWithDetails = {
  id: string;
  name: string;
  createdAt: string;
  syncUserId: string | null;
  syncStatus: 'local' | 'pending' | 'synced';
  inviteCode: string | null;
  members: GroupMember[];
  expenses: GroupExpense[];
};

export type GroupMember = {
  id: string;
  groupId: string;
  name: string;
  createdAt: string;
};
