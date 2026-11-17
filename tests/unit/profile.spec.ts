import { describe, expect, it } from "vitest";
import {
  STEP_FIELDS,
  validateDraft,
  validateProfileInput,
  validateStep,
  type FieldError,
} from "../../src/domain/profile";
import { e1, e2 } from "../fixtures/profiles";

const rub = (amount: number) => ({ amount, currency: "RUB" as const });

function errorsOf(input: unknown): FieldError[] {
  const res = validateProfileInput(input);
  return res.ok ? [] : res.error;
}

function codes(input: unknown): string[] {
  return errorsOf(input).map((e) => `${e.field}:${e.code}`);
}

describe("validateProfileInput", () => {
  it("accepts the reference profiles", () => {
    expect(validateProfileInput(e1.input).ok).toBe(true);
    expect(validateProfileInput(e2.input).ok).toBe(true);
  });

  it("returns errors as values, never throws", () => {
    expect(() => validateProfileInput(null)).not.toThrow();
    expect(() => validateProfileInput("garbage")).not.toThrow();
    expect(validateProfileInput(null).ok).toBe(false);
  });

  it("reports missing required fields", () => {
    const all = codes({});
    for (const field of [
      "incomeType",
      "monthlyIncome",
      "mandatoryExpenses",
      "debtPayments",
      "debtTotal",
      "dependents",
      "savings",
      "goal",
      "controlLevel",
    ]) {
      expect(all).toContain(`${field}:REQUIRED`);
    }
  });

  it("requires monthlyIncome > 0", () => {
    expect(codes({ ...e1.input, monthlyIncome: rub(0) })).toContain(
      "monthlyIncome:MUST_BE_POSITIVE",
    );
  });

  it("rejects negative and fractional kopecks", () => {
    expect(codes({ ...e1.input, savings: rub(-1) })).toContain("savings:INVALID");
    expect(codes({ ...e1.input, savings: rub(1.5) })).toContain("savings:INVALID");
  });

  it("requires the income range when income is not fixed", () => {
    const { incomeMin: _min, incomeMax: _max, ...noRange } = e2.input;
    const c = codes(noRange);
    expect(c).toContain("incomeMin:REQUIRED");
    expect(c).toContain("incomeMax:REQUIRED");
  });

  it("checks incomeMin ≤ monthlyIncome ≤ incomeMax and incomeMin > 0", () => {
    expect(codes({ ...e2.input, incomeMin: rub(9_500_000) })).toContain(
      "incomeMin:MIN_EXCEEDS_AVERAGE",
    );
    expect(codes({ ...e2.input, incomeMax: rub(8_000_000) })).toContain(
      "incomeMax:MAX_BELOW_AVERAGE",
    );
    expect(codes({ ...e2.input, incomeMin: rub(0) })).toContain("incomeMin:MUST_BE_POSITIVE");
  });

  it("drops the income range for a fixed salary", () => {
    const res = validateProfileInput({ ...e1.input, incomeMin: rub(1), incomeMax: rub(2) });
    expect(res.ok).toBe(true);
    expect(res.ok && "incomeMin" in res.value).toBe(false);
  });

  it("requires debtTotal > 0 when there are debt payments", () => {
    expect(codes({ ...e1.input, debtPayments: rub(1_000_000), debtTotal: rub(0) })).toContain(
      "debtTotal:DEBT_TOTAL_REQUIRED",
    );
  });

  it("limits dependents to 0–20 whole people", () => {
    expect(codes({ ...e1.input, dependents: 21 })).toContain("dependents:OUT_OF_RANGE");
    expect(codes({ ...e1.input, dependents: -1 })).toContain("dependents:OUT_OF_RANGE");
    expect(codes({ ...e1.input, dependents: 1.5 })).toContain("dependents:OUT_OF_RANGE");
    expect(validateProfileInput({ ...e1.input, dependents: 20 }).ok).toBe(true);
  });

  it("rejects implausible obligations above 100 × income", () => {
    const income = e1.input.monthlyIncome.amount;
    expect(validateProfileInput({ ...e1.input, mandatoryExpenses: rub(income * 100) }).ok).toBe(
      true,
    );
    expect(
      codes({
        ...e1.input,
        mandatoryExpenses: rub(income * 100),
        debtPayments: rub(1),
        debtTotal: rub(1),
      }),
    ).toContain("mandatoryExpenses:IMPLAUSIBLE");
  });

  it("rejects unknown enum values", () => {
    expect(codes({ ...e1.input, goal: "lottery" })).toContain("goal:INVALID");
  });
});

describe("validateStep", () => {
  it("only reports fields of the given step", () => {
    expect(validateStep({ incomeType: "fixed", monthlyIncome: rub(100) }, 1)).toEqual([]);
    const step2 = validateStep({ incomeType: "fixed", monthlyIncome: rub(100) }, 2);
    expect(step2.length).toBeGreaterThan(0);
    expect(step2.every((e) => (STEP_FIELDS[2] as readonly string[]).includes(e.field))).toBe(true);
    expect(step2.map((e) => e.field)).toContain("mandatoryExpenses");
  });

  it("covers 11 questions in 4 steps", () => {
    expect(Object.keys(STEP_FIELDS)).toHaveLength(4);
    expect(Object.values(STEP_FIELDS).flat()).toHaveLength(11);
  });
});

describe("validateDraft", () => {
  it("accepts a partial draft with a step and timestamp", () => {
    const res = validateDraft({
      step: 2,
      updatedAt: "2026-11-17T10:00:00.000Z",
      incomeType: "freelance",
      monthlyIncome: rub(9_000_000),
    });
    expect(res.ok).toBe(true);
  });

  it("rejects a draft with an invalid step", () => {
    expect(validateDraft({ step: 5, updatedAt: "2026-11-17T10:00:00.000Z" }).ok).toBe(false);
  });
});
