/**
 * The user's decision on a recommendation (FR-013, FR-018).
 * Transitions: pending → accepted, pending → overridden, accepted → overridden,
 * overridden → overridden (another method). Nothing returns to pending or to accepted.
 */
import type { MethodId } from "./methods/catalog";
import type { Recommendation } from "./recommendation";

export type DecisionChoice = { kind: "accept" } | { kind: "override"; methodId: MethodId };

export function decide(rec: Recommendation, choice: DecisionChoice, now: string): Recommendation {
  const recommended = rec.recommendedMethodId;
  if (rec.mode === "deficit" || !recommended) {
    throw new Error("Invariant: a deficit-mode recommendation has nothing to decide");
  }

  const accepting =
    choice.kind === "accept" || (rec.decision === "pending" && choice.methodId === recommended);

  if (accepting) {
    if (rec.decision !== "pending") {
      throw new Error(`Invariant: cannot accept a recommendation in state ${rec.decision}`);
    }
    return { ...rec, decision: "accepted", chosenMethodId: recommended, decidedAt: now };
  }

  return {
    ...rec,
    decision: "overridden",
    chosenMethodId: choice.kind === "override" ? choice.methodId : recommended,
    decidedAt: now,
  };
}
