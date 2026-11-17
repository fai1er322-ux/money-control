import { describe, expect, it } from "vitest";
import { buildPlan } from "../../src/domain/methods/build-plan";
import { METHOD_IDS, type MethodId } from "../../src/domain/methods/catalog";
import type { BudgetPlan } from "../../src/domain/plan";
import type { FinancialProfile } from "../../src/domain/profile";
import { e1, e2 } from "../fixtures/profiles";

const NOW = "2026-11-17T10:00:00.000Z";
const PERIOD = { year: 2026, month: 12 };
const rub = (amount: number) => ({ amount, currency: "RUB" as const });

function profile(input: object, overrides: object = {}): FinancialProfile {
  return { id: "p1", createdAt: NOW, ...input, ...overrides } as FinancialProfile;
}

function ctx() {
  return { now: NOW, newId: () => "plan-1", recommendationId: "rec-1" };
}

function amounts(plan: BudgetPlan): Record<string, number> {
  return Object.fromEntries(plan.parts.map((p) => [p.key, p.amount.amount]));
}

function total(plan: BudgetPlan): number {
  return plan.parts.reduce((s, p) => s + p.amount.amount, 0);
}

describe("buildPlan reference examples", () => {
  it("E1: 50/30/20 from 120 000 → 60 000 / 36 000 / 24 000", () => {
    const plan = buildPlan(profile(e1.input), "rule_50_30_20", PERIOD, ctx());
    expect(plan).toMatchObject({
      id: "plan-1",
      recommendationId: "rec-1",
      methodId: "rule_50_30_20",
      period: PERIOD,
      income: rub(12_000_000),
      weeklyLimits: null,
      surplusRule: null,
      warnings: [],
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(plan.parts.map((p) => p.key)).toEqual(["needs", "wants", "savings"]);
    expect(amounts(plan)).toEqual({ needs: 6_000_000, wants: 3_600_000, savings: 2_400_000 });
    expect(plan.parts.every((p) => !p.isManual && !p.isFixed)).toBe(true);
  });

  it("E2: base income + buffer from the weakest month, with the surplus rule", () => {
    const plan = buildPlan(profile(e2.input), "base_plus_buffer", PERIOD, ctx());
    expect(plan.income).toEqual(rub(4_000_000));
    expect(amounts(plan)).toEqual({
      obligations: 3_000_000,
      savings: 400_000,
      flexible: 600_000,
    });
    expect(plan.parts.find((p) => p.key === "obligations")?.isFixed).toBe(true);
    expect(plan.surplusRule).toEqual({
      bufferBp: 5000,
      savingsBp: 3000,
      freeBp: 2000,
      bufferTarget: rub(9_000_000),
    });
  });

  it("E5: weekly limits 100 000 / 50 000 → savings 10 000, flexible 40 000 split by weeks", () => {
    const plan = buildPlan(
      profile(e1.input, { monthlyIncome: rub(10_000_000), mandatoryExpenses: rub(5_000_000) }),
      "weekly_limits",
      PERIOD,
      ctx(),
    );
    expect(amounts(plan)).toEqual({
      obligations: 5_000_000,
      savings: 1_000_000,
      flexible: 4_000_000,
    });
    expect(plan.weeklyLimits?.map((w) => w.limit.amount)).toEqual([
      774_193, 903_225, 903_225, 903_225, 516_132,
    ]);
  });

  it("E6: the rounding remainder goes to savings", () => {
    const plan = buildPlan(
      profile(e1.input, { monthlyIncome: rub(10_000_101) }),
      "rule_50_30_20",
      PERIOD,
      ctx(),
    );
    expect(amounts(plan)).toEqual({ needs: 5_000_050, wants: 3_000_030, savings: 2_000_021 });
  });
});

describe("buildPlan parts per method", () => {
  it("70/20/10 and pay yourself first", () => {
    const p = profile(e1.input);
    expect(amounts(buildPlan(p, "rule_70_20_10", PERIOD, ctx()))).toEqual({
      living: 8_400_000,
      savings: 2_400_000,
      debt_or_giving: 1_200_000,
    });
    expect(amounts(buildPlan(p, "pay_yourself_first", PERIOD, ctx()))).toEqual({
      savings: 2_400_000,
      free: 9_600_000,
    });
  });

  it("envelopes split what is left after obligations and savings by category", () => {
    // 120 000 − 45 000 − 12 000 = 63 000 → 25 200 / 12 600 / 12 600 / 12 600
    expect(amounts(buildPlan(profile(e1.input), "envelopes", PERIOD, ctx()))).toEqual({
      obligations: 4_500_000,
      savings: 1_200_000,
      food: 2_520_000,
      transport: 1_260_000,
      leisure: 1_260_000,
      other: 1_260_000,
    });
  });
});

describe("plan invariants", () => {
  // Deterministic pseudo-random profiles (LCG), so failures are reproducible.
  function* randomProfiles(count: number) {
    let seed = 42;
    const rand = (max: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed % max;
    };
    for (let i = 0; i < count; i++) {
      const income = 1 + rand(100_000_000);
      const mandatory = rand(income);
      const debt = rand(income - mandatory);
      yield profile(e1.input, {
        monthlyIncome: rub(income),
        mandatoryExpenses: rub(mandatory),
        debtPayments: rub(debt),
        debtTotal: rub(debt * 10),
      });
    }
  }

  it("Σ parts = income and parts are non-negative for every method", () => {
    for (const p of randomProfiles(200)) {
      for (const methodId of METHOD_IDS) {
        const plan = buildPlan(p, methodId, PERIOD, ctx());
        expect(total(plan), `${methodId} ${p.monthlyIncome.amount}`).toBe(plan.income.amount);
        expect(plan.parts.every((x) => x.amount.amount >= 0)).toBe(true);
        if (plan.weeklyLimits) {
          const flexible = plan.parts.find((x) => x.key === "flexible")!.amount.amount;
          expect(plan.weeklyLimits.reduce((s, w) => s + w.limit.amount, 0)).toBe(flexible);
        }
      }
    }
  });

  it("is deterministic", () => {
    for (const methodId of METHOD_IDS as readonly MethodId[]) {
      expect(buildPlan(profile(e2.input), methodId, PERIOD, ctx())).toEqual(
        buildPlan(profile(e2.input), methodId, PERIOD, ctx()),
      );
    }
  });
});

describe("plan warnings", () => {
  it("SAVINGS_BELOW_MIN when obligations leave less than the method minimum", () => {
    const plan = buildPlan(
      profile(e1.input, { monthlyIncome: rub(10_000_000), mandatoryExpenses: rub(9_600_000) }),
      "weekly_limits",
      PERIOD,
      ctx(),
    );
    expect(amounts(plan)).toEqual({ obligations: 9_600_000, savings: 400_000, flexible: 0 });
    expect(plan.warnings).toContain("SAVINGS_BELOW_MIN");
  });

  it("OBLIGATIONS_EXCEED_NEEDS for 50/30/20 and 70/20/10", () => {
    const p = profile(e1.input, { mandatoryExpenses: rub(9_000_000) });
    expect(buildPlan(p, "rule_50_30_20", PERIOD, ctx()).warnings).toEqual([
      "OBLIGATIONS_EXCEED_NEEDS",
    ]);
    expect(buildPlan(p, "rule_70_20_10", PERIOD, ctx()).warnings).toEqual([
      "OBLIGATIONS_EXCEED_NEEDS",
    ]);
    expect(buildPlan(profile(e1.input), "rule_70_20_10", PERIOD, ctx()).warnings).toEqual([]);
  });
});
