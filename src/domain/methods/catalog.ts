/**
 * Budgeting method catalog v1 (contracts/scoring-rules-v1.md §2).
 * `order` breaks score ties: the smaller order wins. Plan parts are added with US2 builders.
 */
export const METHOD_IDS = [
  "rule_50_30_20",
  "rule_70_20_10",
  "pay_yourself_first",
  "weekly_limits",
  "envelopes",
  "base_plus_buffer",
] as const;

export type MethodId = (typeof METHOD_IDS)[number];

export interface BudgetMethod {
  id: MethodId;
  order: number;
  titleKey: string;
  descriptionKey: string;
  minSavingsBp: number;
  hasWeeklyLimits: boolean;
}

function method(
  id: MethodId,
  order: number,
  minSavingsBp: number,
  hasWeeklyLimits = false,
): BudgetMethod {
  return {
    id,
    order,
    titleKey: `method.${id}.title`,
    descriptionKey: `method.${id}.description`,
    minSavingsBp,
    hasWeeklyLimits,
  };
}

export const METHODS: readonly BudgetMethod[] = [
  method("rule_50_30_20", 1, 1000),
  method("rule_70_20_10", 2, 1000),
  method("pay_yourself_first", 3, 1000),
  method("weekly_limits", 4, 500, true),
  method("envelopes", 5, 500),
  method("base_plus_buffer", 6, 500),
];

export function getMethod(id: MethodId): BudgetMethod {
  const found = METHODS.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown method ${id}`);
  return found;
}
