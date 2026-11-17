import { err, ok, type Result } from "../../domain/result";
import type { Money } from "../../domain/money";

export type ParseMoneyError = "NOT_A_NUMBER" | "NEGATIVE" | "TOO_MANY_DECIMALS" | "TOO_LARGE";

/**
 * Parses user input in rubles ("1 234,56", "1234.5") into integer kopecks using string
 * arithmetic only — never `parseFloat(x) * 100` (constitution I).
 * Empty input is `null` (field not filled yet).
 */
export function parseRublesToKopecks(input: string): Result<number | null, ParseMoneyError> {
  const s = input.replace(/[\s\u00a0\u202f]/g, "");
  if (s === "") return ok(null);
  if (s.startsWith("-")) return err("NEGATIVE");
  const m = /^(\d+)(?:[.,](\d*))?$/.exec(s);
  if (!m) return err("NOT_A_NUMBER");
  const whole = m[1] ?? "0";
  const frac = m[2] ?? "";
  if (frac.length > 2) return err("TOO_MANY_DECIMALS");
  const kopecks = BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0") || "0");
  if (kopecks > BigInt(Number.MAX_SAFE_INTEGER)) return err("TOO_LARGE");
  return ok(Number(kopecks));
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    formatters.set(currency, f);
  }
  return f;
}

/** Formats integer kopecks for display. Division by 100 happens only here, for output. */
export function formatMoney(m: Money): string {
  const negative = m.amount < 0;
  const abs = Math.abs(m.amount);
  const whole = Math.trunc(abs / 100);
  const kop = abs % 100;
  // Build the decimal from integers so the displayed value is exact.
  const text = formatter(m.currency).format(Number(`${whole}.${String(kop).padStart(2, "0")}`));
  return negative ? `-${text}` : text;
}

const NBSP = String.fromCharCode(160);

/** 3750 bp → "37,5 %". Integer arithmetic; trailing zeros of the fraction are dropped. */
export function formatBpPercent(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const frac = String(Math.abs(bp % 100))
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${whole}${frac ? `,${frac}` : ""}${NBSP}%`;
}

/** 16 (tenths) → "1,6". */
export function formatTenths(x10: number): string {
  const whole = Math.trunc(x10 / 10);
  const frac = Math.abs(x10 % 10);
  return frac === 0 ? String(whole) : `${whole},${frac}`;
}

/**
 * Turns domain explanation params into display params: `*Bp` → percent, `*X10` → tenths,
 * with the suffix dropped (shareBp → share, savingsMonthsX10 → savingsMonths).
 */
export function displayParams(params: Record<string, number>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.endsWith("Bp")) out[key.slice(0, -2)] = formatBpPercent(value);
    else if (key.endsWith("X10")) out[key.slice(0, -3)] = formatTenths(value);
    else out[key] = value;
  }
  return out;
}
