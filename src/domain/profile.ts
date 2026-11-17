/**
 * Financial profile: questionnaire answers (data-model.md «FinancialProfile», «QuestionnaireDraft»).
 * Validation returns FieldError[] as values; nothing here throws on bad input.
 */
import { z } from "zod";
import { err, ok, type Result } from "./result";

export const INCOME_TYPES = ["fixed", "freelance", "mixed", "seasonal"] as const;
export const GOALS = ["emergency_fund", "big_purchase", "debt_payoff", "spending_control"] as const;
export const CONTROL_LEVELS = ["simple", "detailed"] as const;
export const MAX_DEPENDENTS = 20;
/** Obligations above this multiple of income are treated as a typo (data-model.md). */
export const IMPLAUSIBLE_OBLIGATIONS_FACTOR = 100;

export type IncomeType = (typeof INCOME_TYPES)[number];
export type Goal = (typeof GOALS)[number];
export type ControlLevel = (typeof CONTROL_LEVELS)[number];

export interface FieldError {
  field: string;
  code: string;
  params?: Record<string, unknown>;
}

export const moneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.literal("RUB"),
});

const fieldSchemas = {
  incomeType: z.enum(INCOME_TYPES),
  monthlyIncome: moneySchema,
  incomeMin: moneySchema,
  incomeMax: moneySchema,
  mandatoryExpenses: moneySchema,
  debtPayments: moneySchema,
  debtTotal: moneySchema,
  dependents: z.number().int().min(0).max(MAX_DEPENDENTS),
  savings: moneySchema,
  goal: z.enum(GOALS),
  controlLevel: z.enum(CONTROL_LEVELS),
} as const;

export type ProfileField = keyof typeof fieldSchemas;

/** 11 questions in 4 steps (FR-001): income → obligations and debts → family and savings → goal. */
export const STEP_FIELDS = {
  1: ["incomeType", "monthlyIncome", "incomeMin", "incomeMax"],
  2: ["mandatoryExpenses", "debtPayments", "debtTotal"],
  3: ["dependents", "savings"],
  4: ["goal", "controlLevel"],
} as const satisfies Record<number, readonly ProfileField[]>;

export type QuestionnaireStep = keyof typeof STEP_FIELDS;
export const QUESTIONNAIRE_STEPS = [1, 2, 3, 4] as const satisfies readonly QuestionnaireStep[];

const PROFILE_FIELDS = Object.keys(fieldSchemas) as ProfileField[];

const answersShape = {
  currency: z.literal("RUB"),
  ...fieldSchemas,
  incomeMin: moneySchema.optional(),
  incomeMax: moneySchema.optional(),
};

export const financialProfileInputSchema = z.object(answersShape);

export const financialProfileSchema = financialProfileInputSchema.extend({
  id: z.string(),
  createdAt: z.iso.datetime(),
});

export const questionnaireDraftSchema = financialProfileInputSchema.partial().extend({
  step: z.union(QUESTIONNAIRE_STEPS.map((s) => z.literal(s))),
  updatedAt: z.iso.datetime(),
});

export type FinancialProfileInput = z.infer<typeof financialProfileInputSchema>;
export type FinancialProfile = z.infer<typeof financialProfileSchema>;
export type QuestionnaireDraft = z.infer<typeof questionnaireDraftSchema>;
/** Answers the questionnaire has collected so far (a draft without its bookkeeping fields). */
export type DraftAnswers = Omit<QuestionnaireDraft, "step" | "updatedAt">;

function isRangeField(field: ProfileField): boolean {
  return field === "incomeMin" || field === "incomeMax";
}

export function validateProfileInput(input: unknown): Result<FinancialProfileInput, FieldError[]> {
  if (typeof input !== "object" || input === null) return err([{ field: "*", code: "INVALID" }]);
  const raw = input as Record<string, unknown>;
  const errors: FieldError[] = [];
  const v: Partial<Record<ProfileField, unknown>> = {};

  if (raw.currency !== undefined && raw.currency !== "RUB") {
    errors.push({ field: "currency", code: "INVALID" });
  }

  const typeParsed = fieldSchemas.incomeType.safeParse(raw.incomeType);
  const needsRange = typeParsed.success && typeParsed.data !== "fixed";

  for (const field of PROFILE_FIELDS) {
    // The range is only asked for non-fixed income; for a fixed salary it is dropped.
    if (isRangeField(field) && !needsRange) continue;
    const value = raw[field];
    if (value === undefined || value === null) {
      errors.push({ field, code: "REQUIRED" });
      continue;
    }
    const parsed = fieldSchemas[field].safeParse(value);
    if (!parsed.success) {
      const outOfRange = field === "dependents" && typeof value === "number";
      errors.push({
        field,
        code: outOfRange ? "OUT_OF_RANGE" : "INVALID",
        ...(outOfRange ? { params: { max: MAX_DEPENDENTS } } : {}),
      });
      continue;
    }
    v[field] = parsed.data;
  }

  const amount = (field: ProfileField): number | undefined =>
    (v[field] as { amount: number } | undefined)?.amount;
  const income = amount("monthlyIncome");
  const min = amount("incomeMin");
  const max = amount("incomeMax");
  const mandatory = amount("mandatoryExpenses");
  const debtPayments = amount("debtPayments");
  const debtTotal = amount("debtTotal");

  if (income === 0) errors.push({ field: "monthlyIncome", code: "MUST_BE_POSITIVE" });
  if (min === 0) errors.push({ field: "incomeMin", code: "MUST_BE_POSITIVE" });
  if (min !== undefined && income !== undefined && min > income) {
    errors.push({ field: "incomeMin", code: "MIN_EXCEEDS_AVERAGE" });
  }
  if (max !== undefined && income !== undefined && max < income) {
    errors.push({ field: "incomeMax", code: "MAX_BELOW_AVERAGE" });
  }
  if (debtPayments !== undefined && debtPayments > 0 && debtTotal === 0) {
    errors.push({ field: "debtTotal", code: "DEBT_TOTAL_REQUIRED" });
  }
  if (income !== undefined && income > 0 && mandatory !== undefined && debtPayments !== undefined) {
    const limit = BigInt(income) * BigInt(IMPLAUSIBLE_OBLIGATIONS_FACTOR);
    if (BigInt(mandatory) + BigInt(debtPayments) > limit) {
      errors.push({
        field: "mandatoryExpenses",
        code: "IMPLAUSIBLE",
        params: { factor: IMPLAUSIBLE_OBLIGATIONS_FACTOR },
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return ok({ currency: "RUB", ...v } as FinancialProfileInput);
}

/** Errors for the fields of one questionnaire step, using everything answered so far. */
export function validateStep(answers: DraftAnswers, step: QuestionnaireStep): FieldError[] {
  const res = validateProfileInput(answers);
  if (res.ok) return [];
  const fields: readonly string[] = STEP_FIELDS[step];
  return res.error.filter((e) => fields.includes(e.field));
}

export function validateDraft(input: unknown): Result<QuestionnaireDraft, FieldError[]> {
  const parsed = questionnaireDraftSchema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  return err(parsed.error.issues.map((i) => ({ field: i.path.join(".") || "*", code: "INVALID" })));
}

export function createProfile(
  input: FinancialProfileInput,
  ctx: { now: string; newId: () => string },
): FinancialProfile {
  return { ...input, id: ctx.newId(), createdAt: ctx.now };
}

/** Answers of a saved profile, used to prefill the questionnaire when editing. */
export function profileToAnswers(profile: FinancialProfile): DraftAnswers {
  const { id: _id, createdAt: _createdAt, ...answers } = profile;
  return answers;
}
