import { describe, expect, it } from "vitest";
import { decide } from "../../src/domain/history";
import { adjustPart } from "../../src/domain/methods/adjust";
import { buildPlan } from "../../src/domain/methods/build-plan";
import type { BudgetPlan } from "../../src/domain/plan";
import type { FinancialProfile } from "../../src/domain/profile";
import { recommend } from "../../src/domain/scoring/engine";
import { SCORING_RULES_V1 } from "../../src/domain/scoring/rules-v1";
import { e1, e4 } from "../fixtures/profiles";

const NOW = "2026-11-17T10:00:00.000Z";
const LATER = "2026-11-18T10:00:00.000Z";
const PERIOD = { year: 2026, month: 12 };
const rub = (amount: number) => ({ amount, currency: "RUB" as const });

function profile(input: object, overrides: object = {}): FinancialProfile {
  return { id: "p1", createdAt: NOW, ...input, ...overrides } as FinancialProfile;
}

function plan(methodId: Parameters<typeof buildPlan>[1], p = profile(e1.input)): BudgetPlan {
  return buildPlan(p, methodId, PERIOD, { now: NOW, newId: () => "plan-1", recommendationId: "r" });
}

function amounts(p: BudgetPlan): Record<string, number> {
  return Object.fromEntries(p.parts.map((x) => [x.key, x.amount.amount]));
}

function unwrap(res: ReturnType<typeof adjustPart>): BudgetPlan {
  if (!res.ok) throw new Error(res.error);
  return res.value;
}

describe("adjustPart", () => {
  it("redistributes the difference over non-manual parts proportionally", () => {
    // wants 36 000 → 50 000; 70 000 left for needs 60 000 and savings 24 000 (5 : 2)
    const next = unwrap(adjustPart(plan("rule_50_30_20"), "wants", rub(5_000_000), LATER));
    expect(amounts(next)).toEqual({ needs: 5_000_000, wants: 5_000_000, savings: 2_000_000 });
    expect(next.parts.find((p) => p.key === "wants")?.isManual).toBe(true);
    expect(next.parts.find((p) => p.key === "needs")?.isManual).toBe(false);
    expect(next.updatedAt).toBe(LATER);
    expect(next.warnings).toEqual([]);
  });

  it("puts the rounding remainder into savings and warns below the method minimum", () => {
    const next = unwrap(adjustPart(plan("rule_50_30_20"), "wants", rub(10_000_000), LATER));
    expect(amounts(next)).toEqual({ needs: 1_428_571, wants: 10_000_000, savings: 571_429 });
    expect(next.warnings).toContain("SAVINGS_BELOW_MIN");
  });

  it("keeps earlier manual parts and never touches fixed parts", () => {
    const first = unwrap(adjustPart(plan("envelopes"), "food", rub(3_000_000), LATER));
    const second = unwrap(adjustPart(first, "leisure", rub(500_000), LATER));
    const a = amounts(second);
    expect(a.obligations).toBe(4_500_000);
    expect(a.food).toBe(3_000_000);
    expect(a.leisure).toBe(500_000);
    expect(Object.values(a).reduce((s, x) => s + x, 0)).toBe(12_000_000);
  });

  it("recomputes weekly limits when flexible changes", () => {
    const p = plan(
      "weekly_limits",
      profile(e1.input, { monthlyIncome: rub(10_000_000), mandatoryExpenses: rub(5_000_000) }),
    );
    const next = unwrap(adjustPart(p, "savings", rub(2_000_000), LATER));
    const flexible = next.parts.find((x) => x.key === "flexible")!.amount.amount;
    expect(flexible).toBe(3_000_000);
    expect(next.weeklyLimits!.reduce((s, w) => s + w.limit.amount, 0)).toBe(3_000_000);
  });

  it("rejects changes to fixed parts", () => {
    expect(adjustPart(plan("envelopes"), "obligations", rub(1), LATER)).toEqual({
      ok: false,
      error: "PART_IS_FIXED",
    });
  });

  it("rejects manual parts that exceed income", () => {
    expect(adjustPart(plan("rule_50_30_20"), "wants", rub(12_000_001), LATER)).toEqual({
      ok: false,
      error: "MANUAL_PARTS_EXCEED_INCOME",
    });
    // envelopes: obligations (fixed) 45 000 + food 80 000 > 120 000
    expect(adjustPart(plan("envelopes"), "food", rub(8_000_000), LATER)).toEqual({
      ok: false,
      error: "MANUAL_PARTS_EXCEED_INCOME",
    });
  });

  it("frees earlier manual parts when nothing else is left to rebalance", () => {
    const a = unwrap(adjustPart(plan("rule_50_30_20"), "needs", rub(5_000_000), LATER));
    const b = unwrap(adjustPart(a, "wants", rub(4_000_000), LATER));
    const c = unwrap(adjustPart(b, "savings", rub(1_000_000), LATER));
    expect(Object.values(amounts(c)).reduce((s, x) => s + x, 0)).toBe(12_000_000);
    expect(amounts(c).savings).toBe(1_000_000);
  });
});

describe("decide", () => {
  const rec = () =>
    recommend(profile(e1.input), SCORING_RULES_V1, { now: NOW, newId: () => "rec-1" });

  it("pending → accepted", () => {
    expect(decide(rec(), { kind: "accept" }, LATER)).toMatchObject({
      decision: "accepted",
      chosenMethodId: "rule_50_30_20",
      decidedAt: LATER,
    });
  });

  it("pending → overridden and accepted → overridden", () => {
    expect(decide(rec(), { kind: "override", methodId: "envelopes" }, LATER)).toMatchObject({
      decision: "overridden",
      chosenMethodId: "envelopes",
    });
    const accepted = decide(rec(), { kind: "accept" }, LATER);
    expect(decide(accepted, { kind: "override", methodId: "weekly_limits" }, LATER)).toMatchObject({
      decision: "overridden",
      chosenMethodId: "weekly_limits",
    });
  });

  it("choosing the recommended method from the catalog counts as accepting it", () => {
    expect(decide(rec(), { kind: "override", methodId: "rule_50_30_20" }, LATER).decision).toBe(
      "accepted",
    );
  });

  it("final states never return to pending or to accepted", () => {
    const accepted = decide(rec(), { kind: "accept" }, LATER);
    expect(() => decide(accepted, { kind: "accept" }, LATER)).toThrow();
    const overridden = decide(rec(), { kind: "override", methodId: "envelopes" }, LATER);
    expect(() => decide(overridden, { kind: "accept" }, LATER)).toThrow();
    expect(
      decide(overridden, { kind: "override", methodId: "rule_50_30_20" }, LATER).decision,
    ).toBe("overridden");
  });

  it("there is nothing to decide in deficit mode", () => {
    const deficit = recommend(profile(e4.input), SCORING_RULES_V1, { now: NOW, newId: () => "r" });
    expect(() => decide(deficit, { kind: "accept" }, LATER)).toThrow();
  });
});
