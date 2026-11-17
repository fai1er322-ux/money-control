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
