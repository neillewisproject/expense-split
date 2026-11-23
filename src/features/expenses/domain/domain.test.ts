import { computeBalances, simplifyDebts, type Expense } from './balances';
import { amountToInput, convertAmount, formatMoney, parseAmount } from './money';
import {
  splitByPercentages,
  splitByShares,
  splitEqually,
  splitExactly,
  splitWithAdjustments,
} from './split';
import { calculateItemizedBill } from './itemized';
import { convertAllocation } from './currency-allocation';
import { getReceiptUris } from './expense';

const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0);

it('preserves legacy receipt references and enforces the multi-photo boundary', () => {
  expect(getReceiptUris({ receiptUri: 'file:///legacy.jpg' })).toEqual(['file:///legacy.jpg']);
  expect(
    getReceiptUris({
      receiptUri: 'file:///first.jpg',
      receiptUris: JSON.stringify(['file:///first.jpg', 'file:///second.jpg']),
    }),
  ).toEqual(['file:///first.jpg', 'file:///second.jpg']);
  const uris = Array.from({ length: 10 }, (_, index) => `file:///receipt-${index}.jpg`);
  expect(getReceiptUris({ receiptUri: null, receiptUris: JSON.stringify(uris) })).toEqual(uris);
  expect(() =>
    getReceiptUris({
      receiptUri: 'file:///extra.jpg',
      receiptUris: JSON.stringify(uris),
    }),
  ).toThrow('at most ten');
  expect(() => getReceiptUris({ receiptUri: null, receiptUris: '{"not":"photos"}' })).toThrow(
    'valid receipt photos',
  );
});

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

  describe('currency-aware money', () => {
    it('uses the currency exponent without floating-point parsing', () => {
      expect(parseAmount('125', 'JPY')).toBe(125);
      expect(parseAmount('125.5', 'JPY')).toBeNull();
      expect(parseAmount('1.234', 'KWD')).toBe(1234);
      expect(amountToInput(1234, 'KWD')).toBe('1.234');
      expect(parseAmount('90071992547409.92')).toBeNull();
      expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe('₹9,00,71,99,25,47,409.91');
      expect(formatMoney(-1)).toBe('-₹0.01');
    });

    it('converts a fixed major-unit rate with explicit rounding and bounds', () => {
      expect(convertAmount(100, 'USD', 'INR', '83.125')).toBe(8313);
      expect(convertAmount(1000, 'JPY', 'USD', '0.0065')).toBe(650);
      expect(convertAmount(-100, 'USD', 'INR', '83.125')).toBe(-8313);
      expect(() => convertAmount(100, 'USD', 'INR', '0')).toThrow();
      expect(() => convertAmount(Number.MAX_SAFE_INTEGER, 'USD', 'INR', '1000')).toThrow();
    });
    it('reconciles converted payer and owed allocations rather than rounding each independently', () => {
      expect(convertAllocation(3, { a: 1, b: 1, c: 1 }, 'USD', 'USD', '0.5')).toEqual({
        total: 2,
        parts: { a: 1, b: 1, c: 0 },
      });
      expect(() => convertAllocation(3, { a: 1 }, 'USD', 'INR', '80')).toThrow();
    });
  });

  describe('advanced splits', () => {
    it('validates exact and percentage totals', () => {
      expect(splitExactly(100, { a: 30, b: 70 })).toEqual({ a: 30, b: 70 });
      expect(() => splitExactly(100, { a: 99 })).toThrow();
      expect(splitByPercentages(101, { a: 50, b: 50 })).toEqual({ a: 51, b: 50 });
      expect(() => splitByPercentages(100, { a: 99.999, b: 0.001 })).toThrow();
    });

    it('applies signed adjustments once and rejects duplicate participants', () => {
      expect(splitWithAdjustments(100, ['a', 'b'], { a: 20 })).toEqual({ a: 60, b: 40 });
      expect(() => splitWithAdjustments(100, ['a', 'b'], { a: -200 })).toThrow();
      expect(() => splitEqually(100, ['a', 'a'])).toThrow();
      expect(sum(splitByShares(Number.MAX_SAFE_INTEGER, { a: 1, b: 2 }))).toBe(
        Number.MAX_SAFE_INTEGER,
      );
    });

    it('nets multiple payers and partial settlements without losing a minor unit', () => {
      const bill: Expense = {
        id: 'bill',
        description: 'Dinner',
        amount: 1000,
        paidBy: 'a',
        contributions: { a: 700, b: 300 },
        split: { a: 500, b: 500 },
        createdAt: '2026-01-01',
      };
      const payment: Expense = {
        id: 'payment',
        description: 'Partial',
        amount: 100,
        paidBy: 'b',
        split: { a: 100 },
        kind: 'settlement',
        createdAt: '2026-01-01',
      };
      expect(computeBalances([bill, payment])).toEqual({ a: 100, b: -100 });
      expect(computeBalances([bill, { ...payment, deletedAt: '2026-01-02' }])).toEqual({
        a: 200,
        b: -200,
      });
      expect(() => computeBalances([{ ...bill, contributions: { a: 999 } }])).toThrow();
    });

    it('reconciles itemized bills and charges without charging excluded members', () => {
      const result = calculateItemizedBill(
        [
          { id: 'food', description: 'Food', quantity: 2, unitAmount: 100, shares: { a: 1, b: 1 } },
          { id: 'drink', description: 'Drink', quantity: 1, unitAmount: 100, shares: { a: 1 } },
        ],
        { discount: 30, tax: 20, tip: 10 },
        ['a', 'b', 'c'],
      );
      expect(result.total).toBe(300);
      expect(result.split).toEqual({ a: 200, b: 100, c: 0 });
      expect(() =>
        calculateItemizedBill(
          [{ id: 'food', description: 'Food', quantity: 1, unitAmount: 100, shares: { a: 1 } }],
          { discount: 101, tax: 0, tip: 0 },
          ['a'],
        ),
      ).toThrow();
    });
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
