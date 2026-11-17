/**
 * Weekly limits (contracts/scoring-rules-v1.md §2): weeks start on Monday and are cut by the
 * month boundaries. Limit = floor(flexible × days / days_in_month); the remainder goes to the
 * last week, so Σ limits = flexible exactly.
 */
import { money, type Money } from "../money";
import type { Period, WeeklyLimit } from "../plan";

const pad = (n: number) => String(n).padStart(2, "0");

export function daysInMonth({ year, month }: Period): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function splitByWeeks(flexible: Money, period: Period): WeeklyLimit[] {
  const total = daysInMonth(period);
  const date = (day: number) => `${period.year}-${pad(period.month)}-${pad(day)}`;

  const ranges: { from: number; to: number }[] = [];
  let start = 1;
  for (let day = 1; day <= total; day++) {
    const weekday = new Date(Date.UTC(period.year, period.month - 1, day)).getUTCDay();
    const isSunday = weekday === 0;
    if (isSunday || day === total) {
      ranges.push({ from: start, to: day });
      start = day + 1;
    }
  }

  const amount = BigInt(flexible.amount);
  const limits = ranges.map((r) => {
    const days = r.to - r.from + 1;
    return { ...r, days, limit: Number((amount * BigInt(days)) / BigInt(total)) };
  });
  const remainder = flexible.amount - limits.reduce((s, w) => s + w.limit, 0);

  return limits.map((w, i) => ({
    weekIndex: i + 1,
    from: date(w.from),
    to: date(w.to),
    days: w.days,
    limit: money(w.limit + (i === limits.length - 1 ? remainder : 0), flexible.currency),
  }));
}
