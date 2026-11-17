/** Budget plan entity (data-model.md «BudgetPlan», «PlanPart»). */
import { z } from "zod";
import { METHOD_IDS } from "./methods/catalog";
import { moneySchema } from "./profile";

export const PLAN_PART_KEYS = [
  "needs",
  "wants",
  "savings",
  "living",
  "debt_or_giving",
  "free",
  "obligations",
  "flexible",
  "food",
  "transport",
  "leisure",
  "other",
] as const;

export const PLAN_WARNINGS = ["SAVINGS_BELOW_MIN", "OBLIGATIONS_EXCEED_NEEDS"] as const;

export const periodSchema = z.object({
  year: z.number().int().min(2000).max(9999),
  month: z.number().int().min(1).max(12),
});

export const planPartSchema = z.object({
  key: z.enum(PLAN_PART_KEYS),
  amount: moneySchema,
  /** Set by the user (FR-016); kept as is when other parts are rebalanced. */
  isManual: z.boolean(),
  /** Equals the actual obligations; never rebalanced or edited. */
  isFixed: z.boolean(),
});

export const weeklyLimitSchema = z.object({
  weekIndex: z.number().int().min(1),
  from: z.iso.date(),
  to: z.iso.date(),
  days: z.number().int().min(1).max(7),
  limit: moneySchema,
});

export const surplusRuleSchema = z.object({
  bufferBp: z.number().int(),
  savingsBp: z.number().int(),
  freeBp: z.number().int(),
  bufferTarget: moneySchema,
});

export const budgetPlanSchema = z.object({
  id: z.string(),
  recommendationId: z.string(),
  methodId: z.enum(METHOD_IDS),
  period: periodSchema,
  income: moneySchema,
  /** Actual monthly obligations of the profile; needed to re-check warnings after edits. */
  obligations: moneySchema,
  parts: z.array(planPartSchema).min(1),
  weeklyLimits: z.array(weeklyLimitSchema).nullable(),
  surplusRule: surplusRuleSchema.nullable(),
  warnings: z.array(z.enum(PLAN_WARNINGS)),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type PlanPartKey = (typeof PLAN_PART_KEYS)[number];
export type PlanWarning = (typeof PLAN_WARNINGS)[number];
export type Period = z.infer<typeof periodSchema>;
export type PlanPart = z.infer<typeof planPartSchema>;
export type WeeklyLimit = z.infer<typeof weeklyLimitSchema>;
export type SurplusRule = z.infer<typeof surplusRuleSchema>;
export type BudgetPlan = z.infer<typeof budgetPlanSchema>;
