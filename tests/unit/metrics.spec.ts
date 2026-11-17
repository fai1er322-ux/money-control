import { describe, expect, it } from "vitest";
import { computeMetrics } from "../../src/domain/metrics";
import type { FinancialProfile } from "../../src/domain/profile";
import { REFERENCE_PROFILES, e1, e2 } from "../fixtures/profiles";

function profile(input: object): FinancialProfile {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    createdAt: "2026-11-17T10:00:00.000Z",
    ...input,
  } as FinancialProfile;
}

const rub = (amount: number) => ({ amount, currency: "RUB" as const });

describe("computeMetrics", () => {
  it.each(REFERENCE_PROFILES.map((f) => [f.name, f] as const))(
    "matches the reference metrics for %s",
    (_name, f) => {
      expect(computeMetrics(profile(f.input))).toEqual(f.expected.metrics);
    },
  );

  it("uses 120 savings months ×10 when there are no obligations", () => {
    const m = computeMetrics(
      profile({ ...e1.input, mandatoryExpenses: rub(0), savings: rub(5_000_000) }),
    );
    expect(m.savingsMonthsX10).toBe(120);
  });

  it("marks income irregular below 7 000 bp stability, not at it", () => {
    const at = computeMetrics(profile({ ...e2.input, incomeMin: rub(6_300_000) }));
    expect(at.stabilityBp).toBe(7000);
    expect(at.isIrregular).toBe(false);
    const below = computeMetrics(profile({ ...e2.input, incomeMin: rub(6_299_999) }));
    expect(below.stabilityBp).toBe(6999);
    expect(below.isIrregular).toBe(true);
  });

  it("treats obligations equal to income as a deficit", () => {
    const m = computeMetrics(profile({ ...e1.input, mandatoryExpenses: rub(12_000_000) }));
    expect(m.isDeficit).toBe(true);
  });

  it("floors ratios without floating point drift on large amounts", () => {
    const big = Number.MAX_SAFE_INTEGER - 1;
    const m = computeMetrics(
      profile({ ...e1.input, monthlyIncome: rub(big), mandatoryExpenses: rub(big - 1) }),
    );
    expect(m.mandatoryShareBp).toBe(9999);
  });
});
