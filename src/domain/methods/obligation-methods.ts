/**
 * Methods built around actual obligations (contracts/scoring-rules-v1.md §2):
 * weekly limits, envelopes, base income + buffer. Obligations are a fixed part; savings are
 * 10 % of income but shrink (down to zero) when obligations leave less.
 */
import { add, allocateBp, money, sub, type Money } from "../money";
import type { PlanPart, PlanPartKey, SurplusRule } from "../plan";
import type { MethodId } from "./catalog";

type ObligationMethodId = Extract<MethodId, "weekly_limits" | "envelopes" | "base_plus_buffer">;

const SAVINGS_BP = 1000;
const ENVELOPES: readonly [PlanPartKey, number][] = [
  ["food", 4000],
  ["transport", 2000],
  ["leisure", 2000],
  ["other", 2000],
];
const SURPLUS = { bufferBp: 5000, savingsBp: 3000, freeBp: 2000 } as const;
const BUFFER_MONTHS = 3;

const part = (key: PlanPartKey, amount: Money, isFixed = false): PlanPart => ({
  key,
  amount,
  isManual: false,
  isFixed,
});

export function buildObligationParts(
  id: ObligationMethodId,
  income: Money,
  obligations: Money,
): { parts: PlanPart[]; surplusRule: SurplusRule | null } {
  const available = sub(income, obligations);
  if (available.amount < 0) {
    throw new Error("Invariant: obligations exceed income (deficit mode has no plan)");
  }
  const [target] = allocateBp(income, [SAVINGS_BP]).parts;
  const savings = money(Math.min(target?.amount ?? 0, available.amount), income.currency);
  const rest = sub(available, savings);

  if (id === "envelopes") {
    const { parts, remainder } = allocateBp(
      rest,
      ENVELOPES.map(([, bp]) => bp),
    );
    return {
      parts: [
        part("obligations", obligations, true),
        part("savings", add(savings, remainder)),
        ...ENVELOPES.map(([key], i) => part(key, parts[i] ?? money(0, income.currency))),
      ],
      surplusRule: null,
    };
  }

  return {
    parts: [
      part("obligations", obligations, true),
      part("savings", savings),
      part("flexible", rest),
    ],
    surplusRule:
      id === "base_plus_buffer"
        ? {
            ...SURPLUS,
            bufferTarget: money(obligations.amount * BUFFER_MONTHS, obligations.currency),
          }
        : null,
  };
}
