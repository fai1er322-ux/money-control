import { describe, expect, it } from "vitest";
import { formatMoney, parseRublesToKopecks } from "../../src/ui/i18n/format";
import { money } from "../../src/domain/money";

describe("parseRublesToKopecks (no floating point, constitution I)", () => {
  it.each([
    ["120000", 12_000_000],
    ["120 000", 12_000_000],
    ["120 000", 12_000_000],
    ["1 234,56", 123_456],
    ["1234.5", 123_450],
    ["0,01", 1],
    ["0", 0],
    ["  42 ", 4_200],
    ["0.29", 29], // 0.29 * 100 = 28.999… in float — must be exact here
  ])("parses %j → %d kopecks", (input, expected) => {
    expect(parseRublesToKopecks(input)).toEqual({ ok: true, value: expected });
  });

  it("treats empty input as no value", () => {
    expect(parseRublesToKopecks("")).toEqual({ ok: true, value: null });
    expect(parseRublesToKopecks("   ")).toEqual({ ok: true, value: null });
  });

  it.each([
    ["-5", "NEGATIVE"],
    ["1,234", "TOO_MANY_DECIMALS"],
    ["abc", "NOT_A_NUMBER"],
    ["1,2,3", "NOT_A_NUMBER"],
    ["1e5", "NOT_A_NUMBER"],
    ["99999999999999999", "TOO_LARGE"],
  ])("rejects %j with %s", (input, error) => {
    expect(parseRublesToKopecks(input)).toEqual({ ok: false, error });
  });
});

describe("formatMoney", () => {
  const norm = (s: string) => s.replace(/\s/g, " ");

  it("formats kopecks as Russian rubles", () => {
    expect(norm(formatMoney(money(123_456)))).toBe("1 234,56 ₽");
  });

  it("omits zero kopecks", () => {
    expect(norm(formatMoney(money(12_000_000)))).toBe("120 000 ₽");
  });

  it("formats negative amounts", () => {
    expect(norm(formatMoney(money(-500_000)))).toBe("-5 000 ₽");
  });
});

describe("explanation params formatting", () => {
  it("formats basis points as a percent and tenths as decimals", async () => {
    const { formatBpPercent, formatTenths, displayParams } =
      await import("../../src/ui/i18n/format");
    expect(formatBpPercent(3750)).toMatch(/^37,5\s%$/);
    expect(formatBpPercent(3000)).toMatch(/^30\s%$/);
    expect(formatBpPercent(4444)).toMatch(/^44,44\s%$/);
    expect(formatTenths(16)).toBe("1,6");
    expect(formatTenths(30)).toBe("3");
    expect(displayParams({ shareBp: 8000, savingsMonthsX10: 5, dependents: 2 })).toEqual({
      share: formatBpPercent(8000),
      savingsMonths: "0,5",
      dependents: 2,
    });
  });
});
