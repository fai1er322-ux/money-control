/**
 * Scoring engine (contracts/scoring-rules-v1.md §1, §3). Pure and deterministic:
 * time and ids come from `ctx`.
 */
import { computeMetrics } from "../metrics";
import { METHODS, type MethodId } from "../methods/catalog";
import { sub } from "../money";
import type { FinancialProfile } from "../profile";
import type { Recommendation, RecommendationFactor } from "../recommendation";
import type { ScoringRuleSet } from "./types";

const MAX_FACTORS = 4;

export function recommend(
  profile: FinancialProfile,
  rules: ScoringRuleSet,
  ctx: { now: string; newId: () => string },
): Recommendation {
  const metrics = computeMetrics(profile);
  const base = {
    id: ctx.newId(),
    createdAt: ctx.now,
    profileId: profile.id,
    rulesVersion: rules.version,
    decision: "pending" as const,
    chosenMethodId: null,
    decidedAt: null,
  };

  // FR-012: with obligations ≥ income no method can work; rules are not evaluated.
  if (metrics.isDeficit) {
    return {
      ...base,
      mode: "deficit",
      scores: {},
      recommendedMethodId: null,
      alternativeMethodId: null,
      factors: [],
      deficit: sub(metrics.obligations, metrics.baseIncome),
    };
  }

  const scoringCtx = { profile, metrics };
  const scores = Object.fromEntries(METHODS.map((m) => [m.id, 0])) as Record<MethodId, number>;
  const fired = rules.rules.filter((rule) => rule.condition(scoringCtx));
  for (const rule of fired) {
    for (const [id, points] of Object.entries(rule.points) as [MethodId, number][]) {
      scores[id] += points;
    }
  }

  const ranked = [...METHODS].sort((a, b) => scores[b.id] - scores[a.id] || a.order - b.order);
  const [first, second] = ranked;
  if (!first || !second) throw new Error("Invariant: the catalog has at least two methods");

  // Array.prototype.sort is stable, so equal points keep the rule-table order.
  const factors: RecommendationFactor[] = fired
    .map((rule) => ({ rule, points: rule.points[first.id] ?? 0 }))
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, MAX_FACTORS)
    .map(({ rule, points }) => ({
      ruleId: rule.id,
      points,
      explanationKey: rule.explanationKey,
      params: rule.params?.(scoringCtx) ?? {},
    }));

  return {
    ...base,
    mode: "normal",
    scores,
    recommendedMethodId: first.id,
    alternativeMethodId: second.id,
    factors,
    deficit: null,
  };
}
