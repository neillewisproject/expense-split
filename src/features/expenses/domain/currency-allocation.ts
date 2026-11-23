import { convertAmount } from './money';
import { splitByShares, splitExactly, type Split } from './split';

export function convertAllocation(
  total: number,
  parts: Split,
  from: string,
  to: string,
  rate: string,
): { total: number; parts: Split } {
  splitExactly(total, parts);
  const converted = convertAmount(total, from, to, rate);
  if (converted <= 0) throw new Error('The converted total must be at least one minor unit');
  const allocated = splitByShares(converted, parts);
  return {
    total: converted,
    parts: Object.fromEntries(Object.keys(parts).map((id) => [id, allocated[id] ?? 0])),
  };
}
