import { describe, expect, it } from "vitest";
import { buildPlan } from "../../src/domain/methods/build-plan";
import type { FinancialProfile } from "../../src/domain/profile";
import { recommend } from "../../src/domain/scoring/engine";
import { SCORING_RULES_V1 } from "../../src/domain/scoring/rules-v1";
import { e1 } from "../fixtures/profiles";

const rub = (amount: number) => ({ amount, currency: "RUB" as const });

describe("performance (SC-006)", () => {
  it("recommend + buildPlan average ≤ 50 ms over 1 000 random profiles", () => {
    let seed = 7;
    const rand = (max: number) => {
      seed = (seed * 48_271) % 2_147_483_647;
      return seed % max;
    };
    const profiles: FinancialProfile[] = Array.from({ length: 1000 }, (_, i) => {
      const income = 1_000_000 + rand(50_000_000);
      const mandatory = rand(income);
      return {
        ...(e1.input as object),
        id: `p-${i}`,
        createdAt: "2026-12-10T09:00:00.000Z",
        monthlyIncome: rub(income),
        mandatoryExpenses: rub(mandatory),
      } as FinancialProfile;
    });

    const started = performance.now();
    for (const profile of profiles) {
      const rec = recommend(profile, SCORING_RULES_V1, {
        now: "2026-12-10T09:00:00.000Z",
        newId: () => "id",
      });
      if (rec.recommendedMethodId) {
        buildPlan(
          profile,
          rec.recommendedMethodId,
          { year: 2026, month: 12 },
          {
            now: rec.createdAt,
            newId: () => "plan",
            recommendationId: rec.id,
          },
        );
      }
    }
    const averageMs = (performance.now() - started) / profiles.length;
    expect(averageMs).toBeLessThanOrEqual(50);
  });
});
