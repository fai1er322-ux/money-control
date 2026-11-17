/**
 * Scoring rules v1.0.0 — a literal transcription of contracts/scoring-rules-v1.md §3.
 * Changing any number here requires a new version (see the contract header).
 */
import type { ScoringRule, ScoringRuleSet } from "./types";

const rule = (r: Omit<ScoringRule, "explanationKey">): ScoringRule => ({
  ...r,
  explanationKey: `rule.${r.id}`,
});

const LOW_SAVINGS_MONTHS_X10 = 30;

export const SCORING_RULES_V1: ScoringRuleSet = {
  version: "1.0.0",
  rules: [
    rule({
      id: "R1_irregular_income",
      condition: ({ metrics }) => metrics.isIrregular,
      points: { base_plus_buffer: 50 },
      params: ({ metrics }) => ({ stabilityBp: metrics.stabilityBp }),
    }),
    rule({
      id: "R2_stable_income",
      condition: ({ metrics }) => metrics.stabilityBp >= 9000,
      points: { rule_50_30_20: 10, pay_yourself_first: 10 },
    }),
    rule({
      id: "R3_low_obligations",
      condition: ({ metrics }) => metrics.mandatoryShareBp <= 5000,
      points: { rule_50_30_20: 30 },
      params: ({ metrics }) => ({ shareBp: metrics.mandatoryShareBp }),
    }),
    rule({
      id: "R4_mid_obligations",
      condition: ({ metrics }) =>
        metrics.mandatoryShareBp > 5000 && metrics.mandatoryShareBp <= 7000,
      points: { rule_70_20_10: 30 },
      params: ({ metrics }) => ({ shareBp: metrics.mandatoryShareBp }),
    }),
    rule({
      id: "R5_high_obligations",
      condition: ({ metrics }) => metrics.mandatoryShareBp > 7000,
      points: { weekly_limits: 30, envelopes: 30 },
      params: ({ metrics }) => ({ shareBp: metrics.mandatoryShareBp }),
    }),
    rule({
      id: "R6_high_debt",
      condition: ({ metrics }) => metrics.debtLoadBp >= 3000,
      points: { envelopes: 35, weekly_limits: 15 },
      params: ({ metrics }) => ({ debtLoadBp: metrics.debtLoadBp }),
    }),
    rule({
      id: "R7_control_detailed",
      condition: ({ profile }) => profile.controlLevel === "detailed",
      points: { envelopes: 15, weekly_limits: 5 },
    }),
    rule({
      id: "R8_control_simple",
      condition: ({ profile }) => profile.controlLevel === "simple",
      points: { pay_yourself_first: 15, rule_50_30_20: 10, rule_70_20_10: 10 },
    }),
    rule({
      id: "R9_goal_emergency_low_savings",
      condition: ({ profile, metrics }) =>
        profile.goal === "emergency_fund" && metrics.savingsMonthsX10 < LOW_SAVINGS_MONTHS_X10,
      points: { pay_yourself_first: 15, rule_50_30_20: 10 },
      params: ({ metrics }) => ({ savingsMonthsX10: metrics.savingsMonthsX10 }),
    }),
    rule({
      id: "R10_goal_big_purchase",
      condition: ({ profile }) => profile.goal === "big_purchase",
      points: { pay_yourself_first: 15 },
    }),
    rule({
      id: "R11_goal_debt_payoff",
      condition: ({ profile }) => profile.goal === "debt_payoff",
      points: { envelopes: 10, rule_70_20_10: 5 },
    }),
    rule({
      id: "R12_goal_spending_control",
      condition: ({ profile }) => profile.goal === "spending_control",
      points: { weekly_limits: 15 },
    }),
    rule({
      id: "R13_dependents_low_savings",
      condition: ({ profile, metrics }) =>
        profile.dependents >= 1 && metrics.savingsMonthsX10 < LOW_SAVINGS_MONTHS_X10,
      points: { pay_yourself_first: 10, rule_50_30_20: 5 },
      params: ({ profile, metrics }) => ({
        dependents: profile.dependents,
        savingsMonthsX10: metrics.savingsMonthsX10,
      }),
    }),
  ],
};
