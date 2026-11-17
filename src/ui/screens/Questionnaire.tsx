import { useState } from "react";
import type { Money } from "../../domain/money";
import {
  CONTROL_LEVELS,
  GOALS,
  INCOME_TYPES,
  QUESTIONNAIRE_STEPS,
  STEP_FIELDS,
  validateProfileInput,
  validateStep,
  type DraftAnswers,
  type FieldError,
  type FinancialProfileInput,
  type ProfileField,
  type QuestionnaireStep,
} from "../../domain/profile";
import { Choice } from "../components/Choice";
import { IntegerInput } from "../components/IntegerInput";
import { MoneyInput } from "../components/MoneyInput";
import { StepLayout } from "../components/StepLayout";
import { t, type MessageKey } from "../i18n/ru";
import { BottomActions } from "../telegram";

export interface QuestionnaireProps {
  initialAnswers: DraftAnswers;
  initialStep: QuestionnaireStep;
  /** Called after every change so an interrupted questionnaire can be resumed (FR-004). */
  onDraftChange: (answers: DraftAnswers, step: QuestionnaireStep) => void;
  onComplete: (input: FinancialProfileInput) => void;
  /** Leaves the questionnaire from step 1 (only when there is something to go back to). */
  onCancel?: (() => void) | undefined;
}

const TOTAL_STEPS = QUESTIONNAIRE_STEPS.length;

function errorText(errors: FieldError[], field: ProfileField): string | undefined {
  const e = errors.find((x) => x.field === field);
  return e
    ? t(`profile.error.${e.code}` as MessageKey, e.params as Record<string, number>)
    : undefined;
}

export function Questionnaire({
  initialAnswers,
  initialStep,
  onDraftChange,
  onComplete,
  onCancel,
}: QuestionnaireProps) {
  const [answers, setAnswers] = useState<DraftAnswers>(initialAnswers);
  const [step, setStep] = useState<QuestionnaireStep>(initialStep);
  const [errors, setErrors] = useState<FieldError[]>([]);

  function set<F extends ProfileField>(field: F, value: DraftAnswers[F] | null) {
    const { [field]: _previous, ...rest } = answers;
    const next = (
      value === null || value === undefined ? rest : { ...answers, [field]: value }
    ) as DraftAnswers;
    setAnswers(next);
    setErrors((prev) => prev.filter((e) => e.field !== field));
    onDraftChange(next, step);
  }

  function goTo(next: QuestionnaireStep) {
    setErrors([]);
    setStep(next);
    onDraftChange(answers, next);
  }

  function handleNext() {
    const stepErrors = validateStep(answers, step);
    if (stepErrors.length > 0) {
      setErrors(stepErrors);
      return;
    }
    if (step < TOTAL_STEPS) {
      goTo((step + 1) as QuestionnaireStep);
      return;
    }
    const result = validateProfileInput(answers);
    if (result.ok) {
      onComplete(result.value);
      return;
    }
    // Should not happen after per-step checks; return to the first step with an error.
    const firstBad = QUESTIONNAIRE_STEPS.find((s) =>
      (STEP_FIELDS[s] as readonly string[]).some((f) => result.error.some((e) => e.field === f)),
    );
    setStep(firstBad ?? 1);
    setErrors(result.error);
  }

  const back =
    step > 1
      ? { label: t("common.back"), onClick: () => goTo((step - 1) as QuestionnaireStep) }
      : onCancel
        ? { label: t("common.cancel"), onClick: onCancel }
        : null;

  const money = (field: ProfileField) => (answers[field] as Money | undefined) ?? null;
  const moneyField = (field: ProfileField, labelKey: MessageKey, hintKey: MessageKey) => (
    <MoneyInput
      key={field}
      label={t(labelKey)}
      hint={t(hintKey)}
      value={money(field)}
      onChange={(m) => set(field, m)}
      error={errorText(errors, field)}
    />
  );

  const variableIncome = answers.incomeType !== undefined && answers.incomeType !== "fixed";

  return (
    <StepLayout
      title={t(`q.step.${step}`)}
      step={{ current: step, total: TOTAL_STEPS }}
      footer={
        <BottomActions
          primary={{
            label: step === TOTAL_STEPS ? t("q.finish") : t("common.next"),
            onClick: handleNext,
          }}
          back={back}
        />
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleNext();
        }}
      >
        {step === 1 && (
          <>
            <Choice
              legend={t("q.incomeType")}
              value={answers.incomeType ?? null}
              onChange={(v) => set("incomeType", v)}
              error={errorText(errors, "incomeType")}
              options={INCOME_TYPES.map((v) => ({
                value: v,
                label: t(`q.incomeType.${v}`),
                description: t(`q.incomeType.${v}.hint`),
              }))}
            />
            {variableIncome
              ? moneyField(
                  "monthlyIncome",
                  "q.monthlyIncome.variable",
                  "q.monthlyIncome.variable.hint",
                )
              : moneyField("monthlyIncome", "q.monthlyIncome.fixed", "q.monthlyIncome.fixed.hint")}
            {variableIncome && (
              <>
                {moneyField("incomeMin", "q.incomeMin", "q.incomeMin.hint")}
                {moneyField("incomeMax", "q.incomeMax", "q.incomeMax.hint")}
              </>
            )}
          </>
        )}
        {step === 2 && (
          <>
            {moneyField("mandatoryExpenses", "q.mandatoryExpenses", "q.mandatoryExpenses.hint")}
            {moneyField("debtPayments", "q.debtPayments", "q.debtPayments.hint")}
            {moneyField("debtTotal", "q.debtTotal", "q.debtTotal.hint")}
          </>
        )}
        {step === 3 && (
          <>
            <IntegerInput
              label={t("q.dependents")}
              hint={t("q.dependents.hint")}
              value={answers.dependents ?? null}
              onChange={(v) => set("dependents", v)}
              error={errorText(errors, "dependents")}
            />
            {moneyField("savings", "q.savings", "q.savings.hint")}
          </>
        )}
        {step === 4 && (
          <>
            <Choice
              legend={t("q.goal")}
              value={answers.goal ?? null}
              onChange={(v) => set("goal", v)}
              error={errorText(errors, "goal")}
              options={GOALS.map((v) => ({ value: v, label: t(`q.goal.${v}`) }))}
            />
            <Choice
              legend={t("q.controlLevel")}
              value={answers.controlLevel ?? null}
              onChange={(v) => set("controlLevel", v)}
              error={errorText(errors, "controlLevel")}
              options={CONTROL_LEVELS.map((v) => ({
                value: v,
                label: t(`q.controlLevel.${v}`),
                description: t(`q.controlLevel.${v}.hint`),
              }))}
            />
          </>
        )}
        {/* Lets Enter submit the step from a text field. */}
        <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
      </form>
    </StepLayout>
  );
}
