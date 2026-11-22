/**
 * Money is stored as an integer number of minor units (paise, cents).
 * Never store money as a float: 0.1 + 0.2 !== 0.3.
 */
export type MinorUnits = number;

export const DEFAULT_CURRENCY = 'INR';

/** Parses user input like "120", "120.5" or "1,200.50" into minor units. Returns null if invalid. */
export function parseAmount(input: string): MinorUnits | null {
  const normalized = input.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const [whole = '0', fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function formatMoney(
  amount: MinorUnits,
  currency: string = DEFAULT_CURRENCY,
  locale = 'en-IN',
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100);
}
