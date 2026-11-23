import { assertMinorUnits, type MinorUnits } from './money';

export type MemberId = string;

/** How much of an expense each member owes, in minor units. Values always sum to the expense total. */
export type Split = Record<MemberId, MinorUnits>;

/**
 * Splits `total` equally. Leftover paise (e.g. ₹100 / 3) go to the first members,
 * so the parts always add up exactly to the total.
 */
export function splitEqually(total: MinorUnits, memberIds: MemberId[]): Split {
  validateTotal(total);
  if (memberIds.length === 0) throw new Error('Cannot split between zero members');
  if (new Set(memberIds).size !== memberIds.length || memberIds.some((id) => !id)) {
    throw new Error('Participants must be unique and non-empty');
  }

  const base = Math.floor(total / memberIds.length);
  const remainder = total - base * memberIds.length;

  return Object.fromEntries(memberIds.map((id, i) => [id, base + (i < remainder ? 1 : 0)]));
}

/**
 * Splits `total` proportionally to each member's share (e.g. { a: 2, b: 1 }).
 * Uses the largest-remainder method so rounding never loses or creates paise.
 */
export function splitByShares(total: MinorUnits, shares: Record<MemberId, number>): Split {
  validateTotal(total);
  if (Object.keys(shares).some((id) => !id)) throw new Error('Participants must be non-empty');
  const allShares = Object.values(shares);
  if (allShares.some((share) => !Number.isFinite(share) || share < 0)) {
    throw new Error('Shares must be finite, non-negative numbers');
  }

  const entries = Object.entries(shares).filter(([, share]) => share > 0);
  const totalShares = entries.reduce((sum, [, share]) => sum + share, 0);
  if (!Number.isFinite(totalShares) || totalShares === 0) {
    throw new Error('At least one member needs a finite positive share');
  }

  const ratios = entries.map(([id, share]) => ({ id, ...numberRatio(share) }));
  const denominator = ratios.reduce(
    (common, ratio) => (common > ratio.denominator ? common : ratio.denominator),
    1n,
  );
  const weights = ratios.map(({ id, numerator, denominator: divisor }) => ({
    id,
    weight: numerator * (denominator / divisor),
  }));
  const weightTotal = weights.reduce((sum, part) => sum + part.weight, 0n);
  const parts = weights.map(({ id, weight }, index) => {
    const numerator = BigInt(total) * weight;
    return {
      id,
      index,
      amount: Number(numerator / weightTotal),
      remainder: numerator % weightTotal,
    };
  });
  let leftover = total - parts.reduce((sum, part) => sum + part.amount, 0);
  for (const part of [...parts].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  )) {
    if (leftover-- <= 0) break;
    part.amount++;
  }
  return Object.fromEntries(parts.map(({ id, amount }) => [id, amount]));
}

function validateTotal(total: number): void {
  assertMinorUnits(total);
  if (total < 0) throw new Error('Total cannot be negative');
}

function numberRatio(value: number): { numerator: bigint; denominator: bigint } {
  const [coefficient = '0', exponentText = '0'] = value.toString().split('e');
  const [whole = '0', fraction = ''] = coefficient.split('.');
  const power = Number(exponentText) - fraction.length;
  return power >= 0
    ? { numerator: BigInt(`${whole}${fraction}`) * 10n ** BigInt(power), denominator: 1n }
    : { numerator: BigInt(`${whole}${fraction}`), denominator: 10n ** BigInt(-power) };
}

export function splitExactly(total: MinorUnits, amounts: Split): Split {
  validateTotal(total);
  const entries = Object.entries(amounts);
  if (
    !entries.length ||
    entries.some(([id, amount]) => !id || !Number.isSafeInteger(amount) || amount < 0)
  ) {
    throw new Error('Exact shares must be non-negative minor units for named participants');
  }
  if (entries.reduce((sum, [, amount]) => sum + BigInt(amount), 0n) !== BigInt(total)) {
    throw new Error('Exact shares must add up to the expense total');
  }
  return { ...amounts };
}

export function splitByPercentages(
  total: MinorUnits,
  percentages: Record<MemberId, number>,
): Split {
  const entries = Object.values(percentages);
  if (
    entries.some(
      (value) =>
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 1e-8,
    )
  ) {
    throw new Error('Percentages must be between 0 and 100 with up to two decimal places');
  }
  const basisPoints = Object.fromEntries(
    Object.entries(percentages).map(([id, value]) => [id, Math.round(value * 100)]),
  );
  if (Object.values(basisPoints).reduce((sum, value) => sum + value, 0) !== 10000) {
    throw new Error('Percentages must add up to 100');
  }
  return splitByShares(total, basisPoints);
}

export function splitWithAdjustments(
  total: MinorUnits,
  memberIds: MemberId[],
  adjustments: Split,
): Split {
  validateTotal(total);
  if (
    Object.entries(adjustments).some(
      ([id, value]) => !memberIds.includes(id) || !Number.isSafeInteger(value),
    )
  ) {
    throw new Error('Adjustments must be integer minor units for selected participants');
  }
  const adjustmentTotal = Object.values(adjustments).reduce(
    (sum, value) => sum + BigInt(value),
    0n,
  );
  const remainder = BigInt(total) - adjustmentTotal;
  if (remainder < 0n || remainder > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Adjustments exceed the available total');
  }
  const base = splitEqually(Number(remainder), memberIds);
  const adjusted = Object.fromEntries(
    memberIds.map((id) => [id, (base[id] ?? 0) + (adjustments[id] ?? 0)]),
  );
  return splitExactly(total, adjusted);
}
