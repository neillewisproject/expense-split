import { convertAllocation } from '@/features/expenses/domain/currency-allocation';

export function convertGroupAllocation(
  total: number,
  parts: Record<string, number>,
  from: string,
  to: string,
  rate: string,
) {
  // JSONB does not preserve object insertion order. Tie-break by stable participant ID everywhere.
  const ordered = Object.fromEntries(
    Object.keys(parts)
      .sort()
      .map((id) => [id, parts[id]!]),
  );
  return convertAllocation(total, ordered, from, to, rate);
}
