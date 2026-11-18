/**
 * Derived profile indicators (data-model.md «ProfileMetrics»).
 * All ratios are floored integers; BigInt keeps the products exact for any safe amount.
 */
import { add, money, type Money } from "./money";
import type { FinancialProfile } from "./profile";

export interface ProfileMetrics {
  baseIncome: Money;
  stabilityBp: number;
  isIrregular: boolean;
  obligations: Money;
  mandatoryShareBp: number;
  debtLoadBp: number;
  savingsMonthsX10: number;
  isDeficit: boolean;
}

const BP = 10_000;
const IRREGULAR_BELOW_BP = 7_000;
const NO_OBLIGATIONS_SAVINGS_MONTHS_X10 = 120;

function floorRatio(numerator: number, scale: number, denominator: number): number {
  return Number((BigInt(numerator) * BigInt(scale)) / BigInt(denominator));
}

export function computeMetrics(profile: FinancialProfile): ProfileMetrics {
  const isFixed = profile.incomeType === "fixed";
  const min = profile.incomeMin;
  if (!isFixed && !min) throw new Error("Invariant: non-fixed income requires incomeMin");

  const baseIncome = isFixed || !min ? profile.monthlyIncome : min;
  if (baseIncome.amount <= 0) throw new Error("Invariant: base income must be positive");

  const stabilityBp = isFixed
    ? BP
    : floorRatio(baseIncome.amount, BP, profile.monthlyIncome.amount);
  const obligations = add(profile.mandatoryExpenses, profile.debtPayments);

  return {
    baseIncome: money(baseIncome.amount, baseIncome.currency),
    stabilityBp,
    isIrregular: !isFixed && stabilityBp < IRREGULAR_BELOW_BP,
    obligations,
    mandatoryShareBp: floorRatio(obligations.amount, BP, baseIncome.amount),
    debtLoadBp: floorRatio(profile.debtPayments.amount, BP, baseIncome.amount),
    savingsMonthsX10:
      obligations.amount === 0
        ? NO_OBLIGATIONS_SAVINGS_MONTHS_X10
        : floorRatio(profile.savings.amount, 10, obligations.amount),
    isDeficit: obligations.amount >= baseIncome.amount,
  };
}

/** Metrics in display order; the change list keeps this order. */
export const METRIC_KEYS = [
  "baseIncome",
  "stabilityBp",
  "isIrregular",
  "obligations",
  "mandatoryShareBp",
  "debtLoadBp",
  "savingsMonthsX10",
  "isDeficit",
] as const satisfies readonly (keyof ProfileMetrics)[];

export type MetricKey = (typeof METRIC_KEYS)[number];

export interface MetricChange {
  metric: MetricKey;
  before: ProfileMetrics[MetricKey];
  after: ProfileMetrics[MetricKey];
}

function sameValue(a: ProfileMetrics[MetricKey], b: ProfileMetrics[MetricKey]): boolean {
  if (typeof a === "object" && typeof b === "object") {
    return a.amount === b.amount && a.currency === b.currency;
  }
  return a === b;
}

/** FR-019: which indicators changed between two profile versions. */
export function diffMetrics(prev: ProfileMetrics, next: ProfileMetrics): MetricChange[] {
  return METRIC_KEYS.filter((k) => !sameValue(prev[k], next[k])).map((metric) => ({
    metric,
    before: prev[metric],
    after: next[metric],
  }));
}
