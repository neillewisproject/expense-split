import { computeBalances, simplifyDebts, type Expense } from './balances';
import { formatMoney, parseAmount } from './money';
import { splitByShares, splitEqually } from './split';

const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0);

describe('parseAmount', () => {
  it.each([
    ['120', 12000],
    ['120.5', 12050],
    ['1,200.05', 120005],
    [' 0.99 ', 99],
  ])('parses %p', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.234', '1.2.3'])('rejects %p', (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats minor units as currency', () => {
    expect(formatMoney(123456)).toBe('₹1,234.56');
  });
});

describe('splitEqually', () => {
  it('gives leftover paise to the first members so nothing is lost', () => {
    const split = splitEqually(10000, ['a', 'b', 'c']);
    expect(split).toEqual({ a: 3334, b: 3333, c: 3333 });
    expect(sum(split)).toBe(10000);
  });

  it('rejects an empty member list', () => {
    expect(() => splitEqually(100, [])).toThrow();
  });
});

describe('splitByShares', () => {
  it('splits proportionally and always sums to the total', () => {
    expect(sum(splitByShares(1000, { a: 1, b: 1, c: 1 }))).toBe(1000);
    expect(splitByShares(900, { a: 2, b: 1 })).toEqual({ a: 600, b: 300 });
  });

  it('ignores members with a zero share', () => {
    expect(splitByShares(500, { a: 1, b: 0 })).toEqual({ a: 500 });
  });

  it('rejects negative or non-finite shares', () => {
    expect(() => splitByShares(500, { a: 1, b: -1 })).toThrow(
      'Shares must be finite, non-negative numbers',
    );
    expect(() => splitByShares(500, { a: Number.POSITIVE_INFINITY })).toThrow(
      'Shares must be finite, non-negative numbers',
    );
  });

  it('rejects a share total that overflows', () => {
    expect(() => splitByShares(500, { a: Number.MAX_VALUE, b: Number.MAX_VALUE })).toThrow(
      'At least one member needs a finite positive share',
    );
  });
});

describe('computeBalances', () => {
  it('nets what each member paid against what they owe', () => {
    const expenses: Expense[] = [
      {
        id: '1',
        description: 'Dinner',
        amount: 3000,
        paidBy: 'asha',
        split: splitEqually(3000, ['asha', 'ben', 'chen']),
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        description: 'Cab',
        amount: 600,
        paidBy: 'ben',
        split: splitEqually(600, ['ben', 'chen']),
        createdAt: '2026-01-02T00:00:00Z',
      },
    ];

    const balances = computeBalances(expenses);
    expect(balances).toEqual({ asha: 2000, ben: -700, chen: -1300 });
    expect(sum(balances)).toBe(0);
  });
});

describe('simplifyDebts', () => {
  it('returns no settlements when everyone is even', () => {
    expect(simplifyDebts({ asha: 0, ben: 0, chen: 0 })).toEqual([]);
  });

  it('produces no more than members minus one payments', () => {
    const balances = { asha: 900, ben: 400, chen: -300, diya: -500, eli: -500 };
    expect(simplifyDebts(balances).length).toBeLessThanOrEqual(Object.keys(balances).length - 1);
  });

  it('fully settles balances using paise without self-payments', () => {
    const balances = { asha: 2000, ben: -700, chen: -1300 };
    const settlements = simplifyDebts(balances);
    const remaining: Record<string, number> = { ...balances };

    for (const settlement of settlements) {
      expect(settlement.amount).toBeGreaterThan(0);
      expect(settlement.from).not.toBe(settlement.to);
      remaining[settlement.from] = (remaining[settlement.from] ?? 0) + settlement.amount;
      remaining[settlement.to] = (remaining[settlement.to] ?? 0) - settlement.amount;
    }

    expect(remaining).toEqual({ asha: 0, ben: 0, chen: 0 });
  });

  it('rejects balances that cannot be settled exactly', () => {
    expect(() => simplifyDebts({ asha: 100 })).toThrow('Balances must sum to zero');
    expect(() => simplifyDebts({ asha: Number.POSITIVE_INFINITY, ben: 0 })).toThrow(
      'Balances must be safe integer minor units',
    );
  });
});
