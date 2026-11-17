import { describe, expect, it, vi } from "vitest";
import { METHODS } from "../../src/domain/methods/catalog";
import type { FinancialProfile } from "../../src/domain/profile";
import { recommend } from "../../src/domain/scoring/engine";
import { SCORING_RULES_V1 } from "../../src/domain/scoring/rules-v1";
import type { ScoringRuleSet } from "../../src/domain/scoring/types";
import { REFERENCE_PROFILES, e1, e4 } from "../fixtures/profiles";

const NOW = "2026-11-17T10:00:00.000Z";

function profile(input: object): FinancialProfile {
  return { id: "profile-1", createdAt: NOW, ...input } as FinancialProfile;
}

function ctx() {
  let n = 0;
  return { now: NOW, newId: () => `rec-${++n}` };
}

describe("METHODS catalog", () => {
  it("lists the six v1 methods in contract order", () => {
    expect(METHODS.map((m) => [m.order, m.id])).toEqual([
      [1, "rule_50_30_20"],
      [2, "rule_70_20_10"],
      [3, "pay_yourself_first"],
      [4, "weekly_limits"],
      [5, "envelopes"],
      [6, "base_plus_buffer"],
    ]);
    expect(METHODS.filter((m) => m.hasWeeklyLimits).map((m) => m.id)).toEqual(["weekly_limits"]);
  });
});

describe("recommend with SCORING_RULES_V1", () => {
  it("has version 1.0.0 and 13 rules", () => {
    expect(SCORING_RULES_V1.version).toBe("1.0.0");
    expect(SCORING_RULES_V1.rules).toHaveLength(13);
  });

  it.each(REFERENCE_PROFILES.map((f) => [f.name, f] as const))("reference %s", (_name, f) => {
    const rec = recommend(profile(f.input), SCORING_RULES_V1, ctx());
    expect(rec).toMatchObject({
      id: "rec-1",
      createdAt: NOW,
      profileId: "profile-1",
      rulesVersion: "1.0.0",
      mode: f.expected.mode,
      scores: f.expected.scores,
      recommendedMethodId: f.expected.recommendedMethodId,
      alternativeMethodId: f.expected.alternativeMethodId,
      deficit: f.expected.deficit,
      decision: "pending",
      chosenMethodId: null,
      decidedAt: null,
    });
    expect(rec.factors.map(({ ruleId, points }) => ({ ruleId, points }))).toEqual(
      f.expected.factors,
    );
  });

  it("is deterministic", () => {
    const a = recommend(profile(e1.input), SCORING_RULES_V1, ctx());
    const b = recommend(profile(e1.input), SCORING_RULES_V1, ctx());
    expect(a).toEqual(b);
  });

  it("passes the obligation share to the explanation in basis points", () => {
    const rec = recommend(profile(e1.input), SCORING_RULES_V1, ctx());
    const r3 = rec.factors.find((f) => f.ruleId === "R3_low_obligations");
    expect(r3?.params).toEqual({ shareBp: 3750 });
    expect(r3?.explanationKey).toBe("rule.R3_low_obligations");
  });
});

describe("recommend engine", () => {
  const always = () => true;

  it("breaks ties by the smaller catalog order", () => {
    const rules: ScoringRuleSet = {
      version: "0.0.1",
      rules: [
        {
          id: "A",
          condition: always,
          points: { envelopes: 10, rule_70_20_10: 10 },
          explanationKey: "a",
        },
      ],
    };
    const rec = recommend(profile(e1.input), rules, ctx());
    expect(rec.recommendedMethodId).toBe("rule_70_20_10");
    expect(rec.alternativeMethodId).toBe("envelopes");
  });

  it("keeps at most 4 factors ordered by points, then by rule order", () => {
    const rules: ScoringRuleSet = {
      version: "0.0.1",
      rules: [
        { id: "a", condition: always, points: { envelopes: 5 }, explanationKey: "a" },
        { id: "b", condition: always, points: { envelopes: 20 }, explanationKey: "b" },
        { id: "c", condition: always, points: { envelopes: 5 }, explanationKey: "c" },
        { id: "d", condition: always, points: { weekly_limits: 50 }, explanationKey: "d" },
        { id: "e", condition: always, points: { envelopes: 30 }, explanationKey: "e" },
        { id: "f", condition: always, points: { envelopes: 5 }, explanationKey: "f" },
        { id: "g", condition: () => false, points: { envelopes: 100 }, explanationKey: "g" },
      ],
    };
    const rec = recommend(profile(e1.input), rules, ctx());
    expect(rec.recommendedMethodId).toBe("envelopes");
    expect(rec.factors.map((f) => f.ruleId)).toEqual(["e", "b", "a", "c"]);
  });

  it("does not evaluate rules in deficit mode", () => {
    const condition = vi.fn(() => true);
    const rules: ScoringRuleSet = {
      version: "0.0.1",
      rules: [{ id: "x", condition, points: { envelopes: 1 }, explanationKey: "x" }],
    };
    const rec = recommend(profile(e4.input), rules, ctx());
    expect(rec.mode).toBe("deficit");
    expect(condition).not.toHaveBeenCalled();
  });
});
