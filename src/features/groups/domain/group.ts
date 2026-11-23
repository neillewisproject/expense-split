import type { Expense } from '@/features/expenses/domain/balances';
import type { BillAdjustments, BillItem } from '@/features/expenses/domain/itemized';

export type GroupExpenseKind = 'expense' | 'settlement' | 'refund';
export type SplitMode = 'equally' | 'exact' | 'percentages' | 'shares' | 'adjustments' | 'itemized';
export type SplitInputs = {
  mode: SplitMode;
  memberIds: string[];
  values: Record<string, number>;
};

export type GroupExpense = Expense & {
  date: string;
  kind: GroupExpenseKind;
  currency: string;
  contributions: Record<string, number>;
  splitInputs: SplitInputs | null;
  category: string;
  notes: string;
  method: string;
  reference: string;
  authorId: string | null;
  updatedAt: string;
  revision: number;
  deletedAt: string | null;
  itemized: { items: BillItem[]; adjustments: BillAdjustments } | null;
  receipts: string[];
  refundOfId?: string | null;
  refundSnapshot?: GroupRefundSnapshot | null;
  conversion: {
    originalAmount: number;
    originalCurrency: string;
    rate: string;
    originalExponent: number;
    baseExponent: number;
    originalSplit: Record<string, number>;
    originalContributions: Record<string, number>;
    splitInputs: SplitInputs | null;
    itemized: GroupExpense['itemized'];
  } | null;
};

export type GroupRefundSnapshot = {
  sourceCurrency: string;
  sourceAmount: number;
  rate: string;
  sourceExponent: number;
  baseExponent: number;
  sourceSplit: Record<string, number>;
  sourceContributions: Record<string, number>;
  baseRoundingAdjustment: number;
};

export type GroupLedger = {
  id: string;
  name: string;
  currency: string;
  ownerId: string | null;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  members: GroupMember[];
  expenses: Omit<GroupExpense, 'receipts'>[];
  activity: GroupActivity[];
};

export type GroupWithDetails = Omit<GroupLedger, 'expenses'> & {
  expenses: GroupExpense[];
  syncUserId: string | null;
  syncStatus: 'local' | 'pending' | 'synced' | 'conflict';
  inviteCode: string | null;
  inviteExpiresAt?: string | null;
  localRevision: number;
  meMemberId: string | null;
  conflictMessage: string | null;
};

export type GroupMember = {
  id: string;
  groupId: string;
  name: string;
  createdAt: string;
  deactivatedAt: string | null;
  userId: string | null;
};

export type GroupActivity = {
  id: string;
  groupId: string;
  expenseId: string | null;
  actorId: string | null;
  action: string;
  text: string;
  details: string;
  createdAt: string;
};

export type GroupOperation = {
  id: string;
  groupId: string;
  userId: string;
  baseRevision: number;
  localRevision: number;
  snapshot: GroupLedger;
  createdAt: string;
};
