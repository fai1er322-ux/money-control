/**
 * Manual edit of one plan part (FR-016, data-model.md «Ручная корректировка»).
 * The difference is spread over parts that are neither manual nor fixed, in proportion to their
 * current amounts; the rounding remainder goes to savings (or free). Σ parts stays = income.
 */
import { money, type Money } from "../money";
import type { BudgetPlan, PlanPart, PlanPartKey } from "../plan";
import { err, ok, type Result } from "../result";
import { planWarnings, weeklyLimitsFor } from "./build-plan";

export type AdjustError = "MANUAL_PARTS_EXCEED_INCOME" | "PART_IS_FIXED";

export function adjustPart(
  plan: BudgetPlan,
  partKey: PlanPartKey,
  amount: Money,
  now: string,
): Result<BudgetPlan, AdjustError> {
  const target = plan.parts.find((p) => p.key === partKey);
  if (!target) throw new Error(`Invariant: plan has no part ${partKey}`);
  if (target.isFixed) return err("PART_IS_FIXED");
  if (amount.currency !== plan.income.currency || amount.amount < 0) {
    throw new Error("Invariant: amount must be a non-negative sum in the plan currency");
  }

  const others = plan.parts.filter((p) => p.key !== partKey);
  let adjustable = others.filter((p) => !p.isFixed && !p.isManual);
  // When every other editable part is manual, they become automatic again.
  if (adjustable.length === 0) adjustable = others.filter((p) => !p.isFixed);
  const adjustableKeys = new Set(adjustable.map((p) => p.key));

  const kept = others
    .filter((p) => !adjustableKeys.has(p.key))
    .reduce((s, p) => s + p.amount.amount, 0);
  const remaining = plan.income.amount - kept - amount.amount;
  if (remaining < 0) return err("MANUAL_PARTS_EXCEED_INCOME");
  if (adjustable.length === 0 && remaining !== 0) return err("MANUAL_PARTS_EXCEED_INCOME");

  const currentSum = adjustable.reduce((s, p) => s + p.amount.amount, 0);
  const shares = new Map<PlanPartKey, number>(
    adjustable.map((p) => [
      p.key,
      currentSum === 0
        ? 0
        : Number((BigInt(remaining) * BigInt(p.amount.amount)) / BigInt(currentSum)),
    ]),
  );
  const remainder = remaining - [...shares.values()].reduce((s, x) => s + x, 0);
  const sink =
    (["savings", "free"] as const).find((k) => adjustableKeys.has(k)) ?? adjustable.at(-1)?.key;
  if (sink) shares.set(sink, (shares.get(sink) ?? 0) + remainder);

  const parts: PlanPart[] = plan.parts.map((p) => {
    if (p.key === partKey) return { ...p, amount, isManual: true };
    const share = shares.get(p.key);
    if (share === undefined) return p;
    return { ...p, amount: money(share, p.amount.currency), isManual: false };
  });

  return ok({
    ...plan,
    parts,
    weeklyLimits: weeklyLimitsFor(plan.methodId, parts, plan.period),
    warnings: planWarnings(plan.methodId, parts, plan.income, plan.obligations),
    updatedAt: now,
  });
}
