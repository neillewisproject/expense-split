import type { Budget } from '@/features/budgets/data/schema';
import type { StoredExpense } from '@/features/expenses/data/schema';
import { consumption, filterEntries, safeSum } from '@/features/expenses/domain/ledger';
import type { GroupWithDetails } from '@/features/groups/domain/group';
import type { GroupCashMovement } from '@/features/group-cash/data/schema';
import { groupCashOption, matchesCashTransaction } from '@/features/group-cash/domain/cash';
import type { RecurringDraft, RecurringRule } from '@/features/recurrence/data/schema';
import { z } from 'zod';
import { monthPeriod, previousMonth, validatePeriod, type DatePeriod } from './periods';

export function periodReport(entries: StoredExpense[], month: string, currency: string) {
  return rangeReport(entries, monthPeriod(month), currency);
}

export function rangeReport(entries: StoredExpense[], period: DatePeriod, currency: string) {
  validatePeriod(period);
  const rows = filterEntries(entries, { currency }).filter(
    (entry) => entry.date >= period.start && entry.date <= period.end,
  );
  const spending = safeSum(rows.map(consumption));
  const income = safeSum(
    rows.filter((entry) => entry.entryType === 'income').map((entry) => entry.amount),
  );
  const categories = [...new Set(rows.map((entry) => entry.category))]
    .map((category) => ({
      category,
      amount: safeSum(rows.filter((entry) => entry.category === category).map(consumption)),
    }))
    .filter((item) => item.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
  return { spending, income, net: safeSum([income, -spending]), categories, count: rows.length };
}

export function reportComparison(
  current: ReturnType<typeof rangeReport>,
  previous: ReturnType<typeof rangeReport>,
) {
  return {
    spending: safeSum([current.spending, -previous.spending]),
    income: safeSum([current.income, -previous.income]),
    net: safeSum([current.net, -previous.net]),
  };
}

const commitmentTemplate = z.object({
  description: z.string().min(1),
  amount: z.number().refine((value) => Number.isSafeInteger(value) && value > 0),
  currency: z.string().default('INR'),
  entryType: z.enum(['expense', 'income', 'transfer']).default('expense'),
});

export function plannedCommitments(
  rules: RecurringRule[],
  drafts: RecurringDraft[],
  period: DatePeriod,
  currency: string,
) {
  validatePeriod(period);
  const existing = new Set(drafts.map((draft) => draft.id));
  const candidates = [
    ...drafts
      .filter((draft) => draft.status === 'pending')
      .map((draft) => ({ id: draft.id, date: draft.date, template: draft.template, draft: true })),
    ...rules
      .filter(
        (rule) =>
          rule.active &&
          (!rule.endDate || rule.nextDate <= rule.endDate) &&
          !existing.has(`${rule.id}:${rule.nextDate}`),
      )
      .map((rule) => ({
        id: `${rule.id}:${rule.nextDate}`,
        date: rule.nextDate,
        template: rule.template,
        draft: false,
      })),
  ];
  return candidates
    .filter((candidate) => candidate.date >= period.start && candidate.date <= period.end)
    .flatMap((candidate) => {
      let raw: unknown;
      try {
        raw = JSON.parse(candidate.template);
      } catch {
        throw new Error('A recurring commitment has invalid template data');
      }
      const parsed = commitmentTemplate.safeParse(raw);
      if (!parsed.success) throw new Error('A recurring commitment has invalid template data');
      if (parsed.data.currency !== currency) return [];
      return [{ ...candidate, ...parsed.data }];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function ownGroupConsumption(
  groups: GroupWithDetails[],
  period: DatePeriod,
  currency: string,
  userId: string | null,
) {
  validatePeriod(period);
  const shares: number[] = [];
  let mappedGroups = 0;
  let unmappedGroups = 0;
  for (const group of groups) {
    if (group.currency !== currency || (group.syncUserId && group.syncUserId !== userId)) continue;
    const memberId = ownMemberId(group, userId);
    if (!memberId) {
      unmappedGroups++;
      continue;
    }
    mappedGroups++;
    for (const entry of group.expenses) {
      if (
        entry.deletedAt ||
        entry.kind === 'settlement' ||
        entry.date < period.start ||
        entry.date > period.end
      )
        continue;
      if (entry.currency !== group.currency)
        throw new Error('A group entry is not stored in its base currency');
      const share = entry.split[memberId] ?? 0;
      if (!Number.isSafeInteger(share) || share < 0 || share > entry.amount)
        throw new Error('A group entry contains an invalid share');
      shares.push(entry.kind === 'refund' ? -share : share);
    }
  }
  return { consumption: safeSum(shares), mappedGroups, unmappedGroups };
}

function ownMemberId(group: GroupWithDetails, userId: string | null): string | null {
  const mapped = group.syncUserId
    ? group.members.filter((member) => member.userId === userId)
    : group.members.filter((member) => member.id === group.meMemberId);
  return mapped.length === 1 ? mapped[0]!.id : null;
}

export type GroupBudgetContext = {
  groups: GroupWithDetails[];
  movements: GroupCashMovement[];
  userId: string | null;
};

function groupBudgetSpending(
  budget: Budget,
  entries: StoredExpense[],
  context: GroupBudgetContext,
): { matched: Set<string>; groupSpending: number } {
  if (budget.accountId || budget.tag)
    throw new Error('Combined budgets cannot filter by account or tag');
  const matched = new Set<string>();
  const seen = new Set<string>();
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const groupsById = new Map(context.groups.map((group) => [group.id, group]));
  const groupExpenses = new Map(
    context.groups.map((group) => [
      group.id,
      new Map(group.expenses.map((entry) => [entry.id, entry])),
    ]),
  );
  for (const movement of context.movements) {
    if (movement.voidedAt || !movement.personalEntryId) continue;
    const entry = entriesById.get(movement.personalEntryId);
    if (!entry || !matchesCashTransaction(movement, entry) || seen.has(movement.personalEntryId))
      throw new Error('A group cash match is missing, invalid or duplicated');
    seen.add(movement.personalEntryId);
    if (movement.currency !== budget.currency || !entry.date.startsWith(budget.month)) continue;
    const group = groupsById.get(movement.groupId);
    const expense = groupExpenses.get(movement.groupId)?.get(movement.expenseId);
    if (!group || !expense)
      throw new Error('A matched group entry is unavailable; review the cash match');
    const current = groupCashOption(group, expense, context.userId);
    if (
      current.memberId !== movement.memberId ||
      current.currency !== movement.currency ||
      current.amount !== movement.amount ||
      current.direction !== movement.direction ||
      current.expenseRevision !== movement.expenseRevision
    )
      throw new Error('A matched group entry changed; review the cash match');
    matched.add(entry.id);
  }
  const shares: number[] = [];
  for (const group of context.groups) {
    if (
      group.currency !== budget.currency ||
      (group.syncUserId && group.syncUserId !== context.userId)
    )
      continue;
    const relevant = group.expenses.filter(
      (entry) =>
        !entry.deletedAt &&
        entry.kind !== 'settlement' &&
        entry.date.startsWith(budget.month) &&
        (!budget.category || entry.category === budget.category),
    );
    if (!relevant.length) continue;
    if (group.syncStatus === 'conflict')
      throw new Error('Resolve group conflicts before combining budgets');
    const memberId = ownMemberId(group, context.userId);
    if (!memberId)
      throw new Error(`Select or claim your participant in ${group.name} before combining budgets`);
    for (const entry of relevant) {
      if (entry.currency !== group.currency)
        throw new Error('A group entry is not in its base currency');
      const share = entry.split[memberId] ?? 0;
      if (!Number.isSafeInteger(share) || share < 0 || share > entry.amount)
        throw new Error('A group entry contains an invalid share');
      shares.push(entry.kind === 'refund' ? -share : share);
    }
  }
  return { matched, groupSpending: safeSum(shares) };
}

export function validateCarryover(budget: Budget, allBudgets: Budget[]): Budget | null {
  if (!budget.carryoverFromId) return null;
  const source = allBudgets.find((item) => item.id === budget.carryoverFromId);
  if (
    !source ||
    source.id === budget.id ||
    source.month !== previousMonth(budget.month) ||
    source.currency !== budget.currency ||
    source.category !== budget.category ||
    source.accountId !== budget.accountId ||
    source.tag !== budget.tag ||
    (source.basis ?? 'personal') !== (budget.basis ?? 'personal')
  ) {
    throw new Error(
      'Carryover must link the immediately previous month with identical currency and filters',
    );
  }
  return source;
}

function carryoverAmount(
  budget: Budget,
  entries: StoredExpense[],
  allBudgets: Budget[],
  groupContext?: GroupBudgetContext,
): number {
  let current = budget;
  const chain: Budget[] = [];
  const seen = new Set<string>([budget.id]);
  while (current.carryoverFromId) {
    const source = validateCarryover(current, allBudgets)!;
    if (seen.has(source.id)) throw new Error('Budget carryover contains a cycle');
    seen.add(source.id);
    chain.push(source);
    current = source;
  }
  let carryover = 0;
  for (const source of chain.reverse()) {
    const progress = budgetProgress(
      { ...source, amount: safeSum([source.amount, carryover]), carryoverFromId: null },
      entries,
      [],
      groupContext,
    );
    carryover = Math.max(0, progress.remaining);
  }
  return carryover;
}

export function budgetProgress(
  budget: Budget,
  entries: StoredExpense[],
  allBudgets: Budget[] = [],
  groupContext?: GroupBudgetContext,
) {
  const carryover = carryoverAmount(budget, entries, allBudgets, groupContext);
  const limit = safeSum([budget.amount, carryover]);
  const attributed = entries.map((entry) => {
    if (entry.entryType !== 'refund') return entry;
    const original = entries.find((row) => row.id === entry.refundOfId);
    return original
      ? {
          ...entry,
          accountId: original.accountId,
          tags: original.tags,
          category: original.category,
        }
      : entry;
  });
  const groupData =
    budget.basis === 'combined'
      ? groupContext
        ? groupBudgetSpending(budget, entries, groupContext)
        : (() => {
            throw new Error('Group data is required for a combined budget');
          })()
      : null;
  const rows = filterEntries(attributed, {
    month: budget.month,
    currency: budget.currency,
    category: budget.category ?? undefined,
    accountId: budget.accountId ?? undefined,
    tag: budget.tag ?? undefined,
  });
  const spent = safeSum([
    ...rows.filter((entry) => !groupData?.matched.has(entry.id)).map(consumption),
    groupData?.groupSpending ?? 0,
  ]);
  const percent = Number((BigInt(Math.max(0, spent)) * 100n) / BigInt(limit));
  return {
    spent,
    remaining: safeSum([limit, -spent]),
    percent,
    warning: percent >= budget.threshold,
    ...(budget.carryoverFromId ? { carryover, limit } : {}),
  };
}
