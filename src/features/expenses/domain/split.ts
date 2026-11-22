import type { MinorUnits } from './money';

export type MemberId = string;

/** How much of an expense each member owes, in minor units. Values always sum to the expense total. */
export type Split = Record<MemberId, MinorUnits>;

/**
 * Splits `total` equally. Leftover paise (e.g. ₹100 / 3) go to the first members,
 * so the parts always add up exactly to the total.
 */
export function splitEqually(total: MinorUnits, memberIds: MemberId[]): Split {
  if (memberIds.length === 0) throw new Error('Cannot split between zero members');

  const base = Math.floor(total / memberIds.length);
  const remainder = total - base * memberIds.length;

  return Object.fromEntries(memberIds.map((id, i) => [id, base + (i < remainder ? 1 : 0)]));
}

/**
 * Splits `total` proportionally to each member's share (e.g. { a: 2, b: 1 }).
 * Uses the largest-remainder method so rounding never loses or creates paise.
 */
export function splitByShares(total: MinorUnits, shares: Record<MemberId, number>): Split {
  const entries = Object.entries(shares).filter(([, share]) => share > 0);
  const totalShares = entries.reduce((sum, [, share]) => sum + share, 0);
  if (totalShares === 0) throw new Error('At least one member needs a positive share');

  const parts = entries.map(([id, share]) => {
    const exact = (total * share) / totalShares;
    return { id, amount: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });

  let leftover = total - parts.reduce((sum, p) => sum + p.amount, 0);
  for (const part of [...parts].sort((a, b) => b.fraction - a.fraction)) {
    if (leftover === 0) break;
    part.amount += 1;
    leftover -= 1;
  }

  return Object.fromEntries(parts.map((p) => [p.id, p.amount]));
}
