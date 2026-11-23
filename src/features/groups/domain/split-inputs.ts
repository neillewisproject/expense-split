import { calculateItemizedBill } from '@/features/expenses/domain/itemized';
import {
  splitByPercentages,
  splitByShares,
  splitEqually,
  splitExactly,
  splitWithAdjustments,
} from '@/features/expenses/domain/split';
import type { GroupExpense, SplitInputs } from './group';

export function calculateSavedSplit(
  total: number,
  inputs: SplitInputs,
  itemized: GroupExpense['itemized'] = null,
): Record<string, number> {
  const orderedValues = (values: Record<string, number>) =>
    Object.fromEntries(
      [
        ...inputs.memberIds.filter((id) => Object.hasOwn(values, id)),
        ...Object.keys(values)
          .filter((id) => !inputs.memberIds.includes(id))
          .sort(),
      ].map((id) => [id, values[id]!]),
    );
  switch (inputs.mode) {
    case 'equally':
      return splitEqually(total, inputs.memberIds);
    case 'exact':
      return splitExactly(total, orderedValues(inputs.values));
    case 'percentages':
      return splitByPercentages(total, orderedValues(inputs.values));
    case 'shares':
      return splitByShares(total, orderedValues(inputs.values));
    case 'adjustments':
      return splitWithAdjustments(total, inputs.memberIds, inputs.values);
    case 'itemized': {
      if (!itemized) throw new Error('Add itemized bill inputs.');
      const result = calculateItemizedBill(
        itemized.items.map((item) => ({
          ...item,
          shares: orderedValues(item.shares),
        })),
        itemized.adjustments,
        inputs.memberIds,
      );
      if (result.total !== total) throw new Error('Itemized total must match the expense total.');
      return result.split;
    }
    default:
      throw new Error('Choose a supported split mode.');
  }
}
