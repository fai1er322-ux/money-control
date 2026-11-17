/**
 * Methods that split income by fixed shares (contracts/scoring-rules-v1.md §2):
 * 50/30/20, 70/20/10, pay yourself first. Rounding remainder → savings.
 */
import { add, allocateBp, type Money } from "../money";
import type { PlanPart, PlanPartKey } from "../plan";
import type { MethodId } from "./catalog";

type PercentMethodId = Extract<MethodId, "rule_50_30_20" | "rule_70_20_10" | "pay_yourself_first">;

const SHARES: Record<PercentMethodId, readonly [PlanPartKey, number][]> = {
  rule_50_30_20: [
    ["needs", 5000],
    ["wants", 3000],
    ["savings", 2000],
  ],
  rule_70_20_10: [
    ["living", 7000],
    ["savings", 2000],
    ["debt_or_giving", 1000],
  ],
  pay_yourself_first: [
    ["savings", 2000],
    ["free", 8000],
  ],
};

export function isPercentMethod(id: MethodId): id is PercentMethodId {
  return id in SHARES;
}

export function buildPercentParts(id: PercentMethodId, income: Money): PlanPart[] {
  const shares = SHARES[id];
  const { parts, remainder } = allocateBp(
    income,
    shares.map(([, bp]) => bp),
  );
  return shares.map(([key], i) => {
    const amount = parts[i] ?? remainder;
    return {
      key,
      amount: key === "savings" ? add(amount, remainder) : amount,
      isManual: false,
      isFixed: false,
    };
  });
}

/** The part that obligations must fit into, for the OBLIGATIONS_EXCEED_NEEDS warning. */
export const NEEDS_PART: Partial<Record<MethodId, PlanPartKey>> = {
  rule_50_30_20: "needs",
  rule_70_20_10: "living",
};
