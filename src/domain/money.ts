/**
 * Money in integer minor units (kopecks). Constitution I: no floating point for money,
 * explicit currency on every amount, no mixing currencies without conversion.
 */

/** ISO 4217. v1 supports RUB only; widen this union to add currencies. */
export type Currency = "RUB";

export interface Money {
  readonly amount: number;
  readonly currency: Currency;
}

export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Currency mismatch: ${a} vs ${b}`);
    this.name = "CurrencyMismatchError";
  }
}

const BP_TOTAL = 10_000;

function assertSafeInteger(n: number, what: string): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${what} must be a safe integer`);
}

export function money(amount: number, currency: Currency = "RUB"): Money {
  assertSafeInteger(amount, "Money amount");
  return { amount, currency };
}

function sameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
}

export function add(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function sub(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function sum(items: readonly Money[], currency: Currency): Money {
  return items.reduce((acc, m) => add(acc, m), money(0, currency));
}

/**
 * Splits `total` by shares in basis points (10 000 = 100 %).
 * Each part is floor(total × share / 10 000); the rounding remainder is returned separately
 * so the caller decides where it goes (contracts/scoring-rules-v1.md §2: into savings).
 * Uses BigInt for the multiplication so large totals cannot overflow.
 */
export function allocateBp(
  total: Money,
  sharesBp: readonly number[],
): { parts: Money[]; remainder: Money } {
  if (total.amount < 0) throw new RangeError("Cannot allocate a negative total");
  let sharesSum = 0;
  for (const s of sharesBp) {
    assertSafeInteger(s, "Share");
    if (s < 0) throw new RangeError("Share must be non-negative");
    sharesSum += s;
  }
  if (sharesSum > BP_TOTAL) throw new RangeError("Shares exceed 10 000 bp");

  const t = BigInt(total.amount);
  const parts = sharesBp.map((s) =>
    money(Number((t * BigInt(s)) / BigInt(BP_TOTAL)), total.currency),
  );
  const allocated = parts.reduce((acc, p) => acc + p.amount, 0);
  return { parts, remainder: money(total.amount - allocated, total.currency) };
}
