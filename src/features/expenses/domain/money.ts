/**
 * Money is stored as an integer number of minor units (paise, cents).
 * Never store money as a float: 0.1 + 0.2 !== 0.3.
 */
export type MinorUnits = number;

export const DEFAULT_CURRENCY = 'INR';

export const SUPPORTED_CURRENCIES = (
  'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD ' +
  'CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD ' +
  'HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD ' +
  'MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG ' +
  'QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD ' +
  'TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWG'
).split(' ');

export function getCurrencyExponent(currency: string): number {
  if (!SUPPORTED_CURRENCIES.includes(currency))
    throw new Error(`Unsupported currency: ${currency}`);
  const exponent = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
  if (exponent === undefined) throw new Error('The runtime did not provide currency precision');
  return exponent;
}

export function assertMinorUnits(amount: number): void {
  if (!Number.isSafeInteger(amount)) throw new Error('Amount must be safe integer minor units');
}

/** Parses user input like "120", "120.5" or "1,200.50" into minor units. Returns null if invalid. */
export function parseAmount(input: string, currency = DEFAULT_CURRENCY): MinorUnits | null {
  const exponent = getCurrencyExponent(currency);
  const normalized = input.replace(/,/g, '').trim();
  if (normalized.length > 64) return null;
  const pattern = exponent === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${exponent}})?$`);
  if (!pattern.test(normalized)) return null;

  const [whole = '0', fraction = ''] = normalized.split('.');
  const amount =
    BigInt(whole) * 10n ** BigInt(exponent) + BigInt(fraction.padEnd(exponent, '0') || '0');
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null;
}

export function amountToInput(amount: MinorUnits, currency = DEFAULT_CURRENCY): string {
  assertMinorUnits(amount);
  const exponent = getCurrencyExponent(currency);
  const magnitude = BigInt(Math.abs(amount));
  const divisor = 10n ** BigInt(exponent);
  const fraction = exponent ? `.${String(magnitude % divisor).padStart(exponent, '0')}` : '';
  return `${amount < 0 ? '-' : ''}${magnitude / divisor}${fraction}`;
}

export function formatMoney(
  amount: MinorUnits,
  currency: string = DEFAULT_CURRENCY,
  locale = 'en-IN',
): string {
  assertMinorUnits(amount);
  const exponent = getCurrencyExponent(currency);
  const magnitude = BigInt(Math.abs(amount));
  const divisor = 10n ** BigInt(exponent);
  // Hermes' Intl cannot format BigInt; the whole part of a safe integer is itself safe.
  const whole = Number(magnitude / divisor);
  const signedWhole = amount < 0 ? -whole : whole;
  const digits = new Intl.NumberFormat(locale, { useGrouping: false });
  const fraction = String(magnitude % divisor)
    .padStart(exponent, '0')
    .split('')
    .map((digit) => digits.format(Number(digit)))
    .join('');
  return new Intl.NumberFormat(locale, { style: 'currency', currency })
    .formatToParts(signedWhole)
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('');
}

/** A fixed major-unit exchange rate; no historical value depends on a later rate lookup. */
export function convertAmount(
  amount: MinorUnits,
  from: string,
  to: string,
  rate: string,
): MinorUnits {
  assertMinorUnits(amount);
  if (rate.length > 40 || !/^\d+(?:\.\d{1,18})?$/.test(rate))
    throw new Error('Enter a positive decimal exchange rate');
  const [whole = '0', fraction = ''] = rate.split('.');
  const rateUnits = BigInt(`${whole}${fraction}`);
  if (rateUnits <= 0n) throw new Error('Exchange rate must be positive');
  const numerator = BigInt(Math.abs(amount)) * rateUnits * 10n ** BigInt(getCurrencyExponent(to));
  const denominator = 10n ** BigInt(fraction.length) * 10n ** BigInt(getCurrencyExponent(from));
  const rounded = (numerator + denominator / 2n) / denominator;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Converted amount is too large');
  return Number(rounded) * (amount < 0 ? -1 : 1);
}
