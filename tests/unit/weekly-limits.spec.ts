import { describe, expect, it } from "vitest";
import { splitByWeeks } from "../../src/domain/methods/weekly";

const rub = (amount: number) => ({ amount, currency: "RUB" as const });

describe("splitByWeeks", () => {
  it("E5: December 2026 starts on Tuesday; remainder goes to the last week", () => {
    const weeks = splitByWeeks(rub(4_000_000), { year: 2026, month: 12 });
    expect(weeks).toEqual([
      { weekIndex: 1, from: "2026-12-01", to: "2026-12-06", days: 6, limit: rub(774_193) },
      { weekIndex: 2, from: "2026-12-07", to: "2026-12-13", days: 7, limit: rub(903_225) },
      { weekIndex: 3, from: "2026-12-14", to: "2026-12-20", days: 7, limit: rub(903_225) },
      { weekIndex: 4, from: "2026-12-21", to: "2026-12-27", days: 7, limit: rub(903_225) },
      { weekIndex: 5, from: "2026-12-28", to: "2026-12-31", days: 4, limit: rub(516_132) },
    ]);
  });

  it("a month starting on Monday (June 2026)", () => {
    const weeks = splitByWeeks(rub(3_000_000), { year: 2026, month: 6 });
    expect(weeks.map((w) => w.days)).toEqual([7, 7, 7, 7, 2]);
    expect(weeks[0]!.from).toBe("2026-06-01");
    expect(weeks.reduce((s, w) => s + w.limit.amount, 0)).toBe(3_000_000);
  });

  it("February of a non-leap year (2027) is four full weeks", () => {
    const weeks = splitByWeeks(rub(2_800_001), { year: 2027, month: 2 });
    expect(weeks.map((w) => w.days)).toEqual([7, 7, 7, 7]);
    expect(weeks.map((w) => w.limit.amount)).toEqual([700_000, 700_000, 700_000, 700_001]);
    expect(weeks.at(-1)!.to).toBe("2027-02-28");
  });

  it("Σ limits = flexible for any amount", () => {
    for (const amount of [0, 1, 7, 99_999, 123_456_789]) {
      for (let month = 1; month <= 12; month++) {
        const weeks = splitByWeeks(rub(amount), { year: 2028, month });
        expect(weeks.reduce((s, w) => s + w.limit.amount, 0)).toBe(amount);
      }
    }
  });
});
