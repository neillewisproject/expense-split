import { getCurrencyExponent } from '@/features/expenses/domain/money';
import { splitByShares } from '@/features/expenses/domain/split';
import type { GroupExpense, GroupLedger, GroupRefundSnapshot } from './group';

type Entry = Omit<GroupExpense, 'receipts'>;
type Budget = { total: number; parts: Record<string, number> };

export function convertRefundSource(
  amount: number,
  rate: string,
  sourceExponent: number,
  baseExponent: number,
): number {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    !/^\d+(?:\.\d{1,18})?$/.test(rate) ||
    rate.length > 40 ||
    ![sourceExponent, baseExponent].every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 3,
    )
  )
    throw new Error('Invalid historical refund conversion.');
  const [whole = '0', fraction = ''] = rate.split('.');
  const units = BigInt(`${whole}${fraction}`);
  if (units <= 0n) throw new Error('Historical exchange rate must be positive.');
  const numerator = BigInt(amount) * units * 10n ** BigInt(baseExponent);
  const denominator = 10n ** BigInt(fraction.length + sourceExponent);
  const rounded = (numerator + denominator / 2n) / denominator;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Converted refund is too large.');
  return Number(rounded);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}

function remaining(original: Budget, refunds: Budget[]): Budget {
  const total = original.total - refunds.reduce((sum, refund) => sum + refund.total, 0);
  const parts = Object.fromEntries(
    Object.keys(original.parts)
      .sort()
      .map((id) => [
        id,
        original.parts[id]! - refunds.reduce((sum, refund) => sum + (refund.parts[id] ?? 0), 0),
      ]),
  );
  if (
    total < 0 ||
    Object.values(parts).some((value) => value < 0) ||
    refunds.some((refund) =>
      Object.entries(refund.parts).some(
        ([id, value]) => value > 0 && !Object.hasOwn(original.parts, id),
      ),
    ) ||
    Object.values(parts).reduce((sum, value) => sum + value, 0) !== total
  ) {
    throw new Error(
      'Refunds cannot exceed the original amount or any participant’s remaining allocation.',
    );
  }
  return { total, parts };
}

function originalSource(original: Entry) {
  return {
    currency: original.conversion?.originalCurrency ?? original.currency,
    total: original.conversion?.originalAmount ?? original.amount,
    split: original.conversion?.originalSplit ?? original.split,
    contributions: original.conversion?.originalContributions ?? original.contributions,
    rate: original.conversion?.rate ?? '1',
    exponent: original.conversion?.originalExponent ?? getCurrencyExponent(original.currency),
    baseExponent: original.conversion?.baseExponent ?? getCurrencyExponent(original.currency),
  };
}

export function refundBudget(group: GroupLedger, originalId: string, excludedId?: string) {
  const original = group.expenses.find((entry) => entry.id === originalId);
  if (!original || original.kind !== 'expense')
    throw new Error('Choose an original group expense.');
  if (original.deletedAt)
    throw new Error('Restore the original expense before recording a refund.');
  const refunds = group.expenses.filter(
    (entry) =>
      entry.kind === 'refund' &&
      entry.refundOfId === originalId &&
      !entry.deletedAt &&
      entry.id !== excludedId,
  );
  const source = originalSource(original);
  return {
    original,
    source,
    baseSplit: remaining(
      { total: original.amount, parts: original.split },
      refunds.map((entry) => ({ total: entry.amount, parts: entry.split })),
    ),
    basePayers: remaining(
      { total: original.amount, parts: original.contributions },
      refunds.map((entry) => ({ total: entry.amount, parts: entry.contributions })),
    ),
    sourceSplit: remaining(
      { total: source.total, parts: source.split },
      refunds.map((entry) => ({
        total: entry.refundSnapshot?.sourceAmount ?? -1,
        parts: entry.refundSnapshot?.sourceSplit ?? {},
      })),
    ),
    sourcePayers: remaining(
      { total: source.total, parts: source.contributions },
      refunds.map((entry) => ({
        total: entry.refundSnapshot?.sourceAmount ?? -1,
        parts: entry.refundSnapshot?.sourceContributions ?? {},
      })),
    ),
  };
}

export function calculateGroupRefund(
  group: GroupLedger,
  originalId: string,
  sourceAmount: number,
  excludedId?: string,
) {
  const budget = refundBudget(group, originalId, excludedId);
  if (
    !Number.isSafeInteger(sourceAmount) ||
    sourceAmount <= 0 ||
    sourceAmount > budget.sourceSplit.total
  ) {
    throw new Error(
      'Enter a positive refund no larger than the remaining original-currency amount.',
    );
  }
  const converted = convertRefundSource(
    sourceAmount,
    budget.source.rate,
    budget.source.exponent,
    budget.source.baseExponent,
  );
  const full = sourceAmount === budget.sourceSplit.total;
  const amount = full ? budget.baseSplit.total : converted;
  if (
    amount <= 0 ||
    amount > budget.baseSplit.total ||
    (!full && amount >= budget.baseSplit.total)
  ) {
    throw new Error(
      'This partial refund cannot be represented safely in base-currency minor units. Refund the full remaining amount instead.',
    );
  }
  const split = splitByShares(amount, budget.baseSplit.parts);
  const contributions = splitByShares(amount, budget.basePayers.parts);
  const refundSnapshot: GroupRefundSnapshot = {
    sourceCurrency: budget.source.currency,
    sourceAmount,
    rate: budget.source.rate,
    sourceExponent: budget.source.exponent,
    baseExponent: budget.source.baseExponent,
    sourceSplit: splitByShares(sourceAmount, budget.sourceSplit.parts),
    sourceContributions: splitByShares(sourceAmount, budget.sourcePayers.parts),
    baseRoundingAdjustment: amount - converted,
  };
  return {
    amount,
    split,
    contributions,
    paidBy: Object.keys(contributions).find((id) => contributions[id]! > 0)!,
    refundOfId: originalId,
    refundSnapshot,
  };
}

export function validateGroupRefunds(group: GroupLedger, before?: GroupLedger): void {
  for (const original of group.expenses.filter((entry) => entry.kind !== 'refund')) {
    if (original.refundOfId || original.refundSnapshot)
      throw new Error('Only refunds can link to an original expense.');
  }
  for (const refund of group.expenses.filter((entry) => entry.kind === 'refund')) {
    const original = group.expenses.find((entry) => entry.id === refund.refundOfId);
    if (!original || original.kind !== 'expense' || !refund.refundSnapshot)
      throw new Error('Every refund must link to an original group expense.');
    if (refund.conversion || refund.itemized || refund.splitInputs)
      throw new Error(
        'Refund allocations are derived from the original ledger, not a new split or exchange rate.',
      );
    const source = originalSource(original);
    const snapshot = refund.refundSnapshot;
    if (
      snapshot.sourceCurrency !== source.currency ||
      snapshot.rate !== source.rate ||
      snapshot.sourceExponent !== source.exponent ||
      snapshot.baseExponent !== source.baseExponent
    ) {
      throw new Error('Refunds must retain the original historical currency and exchange rate.');
    }
    if (
      !Number.isSafeInteger(snapshot.sourceAmount) ||
      snapshot.sourceAmount <= 0 ||
      !Number.isSafeInteger(snapshot.baseRoundingAdjustment) ||
      snapshot.sourceAmount > source.total ||
      refund.amount > original.amount ||
      refund.amount -
        convertRefundSource(
          snapshot.sourceAmount,
          source.rate,
          source.exponent,
          source.baseExponent,
        ) !==
        snapshot.baseRoundingAdjustment
    ) {
      throw new Error('Invalid refund source amount or historical rounding adjustment.');
    }
    for (const [parts, baseline] of [
      [refund.split, original.split],
      [refund.contributions, original.contributions],
      [snapshot.sourceSplit, source.split],
      [snapshot.sourceContributions, source.contributions],
    ] as const) {
      if (Object.entries(parts).some(([id, amount]) => amount > (baseline[id] ?? 0)))
        throw new Error('A refund allocation exceeds its original participant allocation.');
    }
    for (const parts of [snapshot.sourceSplit, snapshot.sourceContributions]) {
      if (
        Object.entries(parts).some(
          ([id, value]) =>
            !group.members.some((member) => member.id === id) ||
            !Number.isSafeInteger(value) ||
            value < 0,
        ) ||
        Object.values(parts).reduce((sum, value) => sum + BigInt(value), 0n) !==
          BigInt(snapshot.sourceAmount)
      ) {
        throw new Error(
          'Refund source allocations must belong to this group and sum to the source refund.',
        );
      }
    }
    if (!refund.deletedAt) {
      const budget = refundBudget(group, original.id);
      if ((budget.sourceSplit.total === 0) !== (budget.baseSplit.total === 0)) {
        throw new Error('Refunds must exhaust original and base amounts together.');
      }
    }
  }
  if (before) {
    for (const old of before.expenses) {
      const current = group.expenses.find((entry) => entry.id === old.id);
      if (!current) continue;
      if (
        (old.refundOfId ?? null) !== (current.refundOfId ?? null) ||
        (old.kind === 'refund' && current.kind !== 'refund')
      ) {
        throw new Error('Refund links and entry kinds cannot be changed.');
      }
      if (group.expenses.some((entry) => entry.refundOfId === old.id)) {
        const financial = (entry: Entry) =>
          JSON.stringify(
            canonical({
              amount: entry.amount,
              paidBy: entry.paidBy,
              split: entry.split,
              contributions: entry.contributions,
              currency: entry.currency,
              conversion: entry.conversion,
              kind: entry.kind,
            }),
          );
        if (financial(old) !== financial(current))
          throw new Error(
            'An expense with refund history cannot change its financial allocations or exchange rate.',
          );
      }
    }
  }
}
