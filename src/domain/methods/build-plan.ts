/**
 * Monthly plan for a chosen method (FR-014, FR-015, FR-017). Pure and deterministic.
 * Guarantees: Σ parts = income; Σ weekly limits = flexible.
 */
import { computeMetrics } from "../metrics";
import { allocateBp, type Money } from "../money";
import type { BudgetPlan, Period, PlanPart, PlanWarning } from "../plan";
import type { FinancialProfile } from "../profile";
import { getMethod, type MethodId } from "./catalog";
import { buildObligationParts } from "./obligation-methods";
import { buildPercentParts, isPercentMethod, NEEDS_PART } from "./percent-methods";
import { splitByWeeks } from "./weekly";

export function planWarnings(
  methodId: MethodId,
  parts: readonly PlanPart[],
  income: Money,
  obligations: Money,
): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const amountOf = (key: string) => parts.find((p) => p.key === key)?.amount.amount ?? 0;
  const [minSavings] = allocateBp(income, [getMethod(methodId).minSavingsBp]).parts;
  if (amountOf("savings") < (minSavings?.amount ?? 0)) warnings.push("SAVINGS_BELOW_MIN");
  const needsKey = NEEDS_PART[methodId];
  if (needsKey && obligations.amount > amountOf(needsKey)) {
    warnings.push("OBLIGATIONS_EXCEED_NEEDS");
  }
  return warnings;
}

export function weeklyLimitsFor(
  methodId: MethodId,
  parts: readonly PlanPart[],
  period: Period,
): BudgetPlan["weeklyLimits"] {
  if (!getMethod(methodId).hasWeeklyLimits) return null;
  const flexible = parts.find((p) => p.key === "flexible");
  if (!flexible) throw new Error("Invariant: weekly limits need a flexible part");
  return splitByWeeks(flexible.amount, period);
}

export function buildPlan(
  profile: FinancialProfile,
  methodId: MethodId,
  period: Period,
  ctx: { now: string; newId: () => string; recommendationId: string },
): BudgetPlan {
  const { baseIncome: income, obligations } = computeMetrics(profile);
  const { parts, surplusRule } = isPercentMethod(methodId)
    ? { parts: buildPercentParts(methodId, income), surplusRule: null }
    : buildObligationParts(methodId, income, obligations);

  return {
    id: ctx.newId(),
    recommendationId: ctx.recommendationId,
    methodId,
    period,
    income,
    obligations,
    parts,
    weeklyLimits: weeklyLimitsFor(methodId, parts, period),
    surplusRule,
    warnings: planWarnings(methodId, parts, income, obligations),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}
