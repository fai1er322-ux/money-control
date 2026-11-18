import { describe, expect, it } from "vitest";
import { computeMetrics, diffMetrics } from "../../src/domain/metrics";
import type { FinancialProfile } from "../../src/domain/profile";
import { e2, e3 } from "../fixtures/profiles";

const rub = (amount: number) => ({ amount, currency: "RUB" as const });

function metrics(input: object, overrides: object = {}) {
  return computeMetrics({
    id: "p",
    createdAt: "2026-11-17T10:00:00.000Z",
    ...input,
    ...overrides,
  } as FinancialProfile);
}

describe("diffMetrics", () => {
  it("E3 with the loan paid off: obligations, share and debt load change", () => {
    const before = metrics(e3.input);
    const after = metrics(e3.input, { debtPayments: rub(0), debtTotal: rub(0) });
    expect(diffMetrics(before, after)).toEqual([
      { metric: "obligations", before: rub(8_000_000), after: rub(5_000_000) },
      { metric: "mandatoryShareBp", before: 8000, after: 5000 },
      { metric: "debtLoadBp", before: 3000, after: 0 },
    ]);
  });

  it("returns an empty list when nothing changed", () => {
    expect(diffMetrics(metrics(e3.input), metrics(e3.input))).toEqual([]);
  });

  it("reports flags such as irregular income", () => {
    const changes = diffMetrics(metrics(e2.input), metrics(e2.input, { incomeType: "fixed" }));
    // Savings months depend on obligations only, so they stay the same.
    expect(changes.map((c) => c.metric)).toEqual([
      "baseIncome",
      "stabilityBp",
      "isIrregular",
      "mandatoryShareBp",
    ]);
    expect(changes.find((c) => c.metric === "isIrregular")).toEqual({
      metric: "isIrregular",
      before: true,
      after: false,
    });
  });
});
