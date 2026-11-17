import { describe, expect, it } from "vitest";
import { add, allocateBp, CurrencyMismatchError, money, sub, sum } from "../../src/domain/money";

describe("Money", () => {
  it("stores amounts as integer kopecks", () => {
    expect(money(12_000_000)).toEqual({ amount: 12_000_000, currency: "RUB" });
  });

  it("rejects non-integer and unsafe amounts", () => {
    expect(() => money(10.5)).toThrow(RangeError);
    expect(() => money(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
    expect(() => money(Number.NaN)).toThrow(RangeError);
  });

  it("adds and subtracts in the same currency", () => {
    expect(add(money(150), money(50))).toEqual(money(200));
    expect(sub(money(150), money(200))).toEqual(money(-50));
    expect(sum([money(1), money(2), money(3)], "RUB")).toEqual(money(6));
  });

  it("throws when currencies differ (constitution I)", () => {
    const usd = { amount: 100, currency: "USD" } as unknown as ReturnType<typeof money>;
    expect(() => add(money(100), usd)).toThrow(CurrencyMismatchError);
    expect(() => sub(money(100), usd)).toThrow(CurrencyMismatchError);
    expect(() => sum([money(1), usd], "RUB")).toThrow(CurrencyMismatchError);
  });

  it("throws when a result leaves the safe integer range", () => {
    expect(() => add(money(Number.MAX_SAFE_INTEGER), money(1))).toThrow(RangeError);
  });
});

describe("allocateBp", () => {
  it("splits by basis points with floor and returns the rounding remainder (E6)", () => {
    const { parts, remainder } = allocateBp(money(10_000_101), [5000, 3000, 2000]);
    expect(parts.map((p) => p.amount)).toEqual([5_000_050, 3_000_030, 2_000_020]);
    expect(remainder).toEqual(money(1));
  });

  it("splits 120 000 ₽ as 50/30/20 exactly (E1)", () => {
    const { parts, remainder } = allocateBp(money(12_000_000), [5000, 3000, 2000]);
    expect(parts.map((p) => p.amount)).toEqual([6_000_000, 3_600_000, 2_400_000]);
    expect(remainder.amount).toBe(0);
  });

  it("parts plus remainder always equal the total", () => {
    for (const total of [0, 1, 7, 99_999, 10_000_101, 123_456_789_01]) {
      const { parts, remainder } = allocateBp(money(total), [3333, 3333, 3334]);
      expect(parts.reduce((s, p) => s + p.amount, 0) + remainder.amount).toBe(total);
    }
  });

  it("does not overflow for large totals", () => {
    const total = 9_000_000_000_000_000; // 9·10^15 kopecks, close to MAX_SAFE_INTEGER
    const { parts, remainder } = allocateBp(money(total), [5000, 5000]);
    expect(parts[0]!.amount + parts[1]!.amount + remainder.amount).toBe(total);
  });

  it("rejects invalid shares", () => {
    expect(() => allocateBp(money(100), [6000, 5000])).toThrow(RangeError);
    expect(() => allocateBp(money(100), [-1])).toThrow(RangeError);
    expect(() => allocateBp(money(100), [10.5])).toThrow(RangeError);
    expect(() => allocateBp(money(-100), [5000])).toThrow(RangeError);
  });
});
