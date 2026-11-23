import { assertMinorUnits } from './money';
import { splitByShares, splitExactly, type Split } from './split';

export type BillItem = {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  shares: Record<string, number>;
};

export type BillAdjustments = { discount: number; tax: number; tip: number };

export function calculateItemizedBill(
  items: BillItem[],
  adjustments: BillAdjustments,
  memberIds: string[],
): { total: number; split: Split; itemTotals: Record<string, number> } {
  if (
    !memberIds.length ||
    new Set(memberIds).size !== memberIds.length ||
    memberIds.some((id) => !id)
  ) {
    throw new Error('Choose unique named participants');
  }
  if (!items.length) throw new Error('Add at least one bill item');
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new Error('Item IDs must be unique');
  const split: Split = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const itemTotals: Record<string, number> = {};
  let subtotal = 0;
  for (const item of items) {
    if (!item.id || !item.description.trim()) throw new Error('Give each item a description');
    assertMinorUnits(item.unitAmount);
    if (item.unitAmount < 0 || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('Item prices cannot be negative and quantities must be positive integers');
    }
    if (Object.keys(item.shares).some((id) => !memberIds.includes(id)))
      throw new Error('Choose participants from this group');
    const amount = item.unitAmount * item.quantity;
    assertMinorUnits(amount);
    itemTotals[item.id] = amount;
    subtotal += amount;
    assertMinorUnits(subtotal);
    for (const [id, owed] of Object.entries(splitByShares(amount, item.shares))) {
      split[id] = (split[id] ?? 0) + owed;
    }
  }
  for (const value of Object.values(adjustments)) {
    assertMinorUnits(value);
    if (value < 0) throw new Error('Discount, tax and tip cannot be negative');
  }
  if (subtotal <= 0 || adjustments.discount > subtotal)
    throw new Error('Discount cannot exceed the subtotal');
  const discount = splitByShares(adjustments.discount, split);
  const charges = adjustments.tax + adjustments.tip;
  assertMinorUnits(charges);
  const extra = splitByShares(charges, split);
  const allocated = Object.fromEntries(
    memberIds.map((id) => [id, (split[id] ?? 0) - (discount[id] ?? 0) + (extra[id] ?? 0)]),
  );
  const total = subtotal - adjustments.discount + charges;
  return { total, split: splitExactly(total, allocated), itemTotals };
}
