export type ProductCode = 'pack_1' | 'pack_5' | 'pack_10' | 'monthly_10' | 'creator_25';
export type PlanCode = 'monthly_10' | 'creator_25';

export interface Product {
  code: ProductCode;
  name: string;
  credits: number;
  amountCents: number;
  currency: 'usd';
  mode: 'payment' | 'subscription';
  interval: 'month' | null;
  popular?: boolean;
}

/** Owner-editable server configuration. Mirrors handoff/contracts/catalog.json. */
export const CATALOG_VERSION = '2026-09-25-proposed';

export const CATALOG: Product[] = [
  { code: 'pack_1', name: '1 credit', credits: 1, amountCents: 499, currency: 'usd', mode: 'payment', interval: null },
  { code: 'pack_5', name: '5 credits', credits: 5, amountCents: 1900, currency: 'usd', mode: 'payment', interval: null, popular: true },
  { code: 'pack_10', name: '10 credits', credits: 10, amountCents: 3500, currency: 'usd', mode: 'payment', interval: null },
  { code: 'monthly_10', name: 'Monthly', credits: 10, amountCents: 2900, currency: 'usd', mode: 'subscription', interval: 'month' },
  { code: 'creator_25', name: 'Creator', credits: 25, amountCents: 5900, currency: 'usd', mode: 'subscription', interval: 'month' },
];

export function getProduct(code: string): Product | undefined {
  return CATALOG.find((p) => p.code === code);
}

export function isProductCode(code: unknown): code is ProductCode {
  return typeof code === 'string' && CATALOG.some((p) => p.code === code);
}

export function isPlanCode(code: unknown): code is PlanCode {
  return code === 'monthly_10' || code === 'creator_25';
}

export function formatUsd(cents: number, opts: { trimZeros?: boolean } = {}): string {
  const dollars = cents / 100;
  const whole = Number.isInteger(dollars);
  if (opts.trimZeros && whole) return `$${dollars}`;
  return `$${dollars.toFixed(2)}`;
}
