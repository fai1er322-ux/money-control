import { useState } from "react";
import type { AdjustError } from "../../domain/methods/adjust";
import { getMethod, type MethodId } from "../../domain/methods/catalog";
import { NEEDS_PART } from "../../domain/methods/percent-methods";
import { allocateBp, money, type Money } from "../../domain/money";
import type { BudgetPlan, PlanPart, PlanPartKey, PlanWarning } from "../../domain/plan";
import type { Result } from "../../domain/result";
import { MoneyInput } from "../components/MoneyInput";
import { StepLayout } from "../components/StepLayout";
import { formatBpPercent, formatMoney } from "../i18n/format";
import { t } from "../i18n/ru";

const partName = (key: PlanPartKey) => t(`plan.part.${key}`);
const methodTitle = (id: MethodId) => t(`method.${id}.title`);

function formatDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}.${month}`;
}

function warningText(plan: BudgetPlan, w: PlanWarning): string {
  if (w === "SAVINGS_BELOW_MIN") {
    const [min] = allocateBp(plan.income, [getMethod(plan.methodId).minSavingsBp]).parts;
    return t("plan.warning.SAVINGS_BELOW_MIN", {
      min: formatMoney(min ?? money(0, plan.income.currency)),
    });
  }
  const needs = NEEDS_PART[plan.methodId] ?? "needs";
  return t("plan.warning.OBLIGATIONS_EXCEED_NEEDS", {
    obligations: formatMoney(plan.obligations),
    part: partName(needs),
  });
}

function PartRow({
  part,
  onSave,
}: {
  part: PlanPart;
  onSave: (amount: Money) => Result<unknown, AdjustError>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<Money | null>(part.amount);
  const [error, setError] = useState<string | undefined>();
  const name = partName(part.key);

  if (editing) {
    return (
      <li className="part-row editing">
        <MoneyInput
          label={t("plan.editLabel", { part: name })}
          value={value}
          onChange={(m) => {
            setValue(m);
            setError(undefined);
          }}
          error={error}
        />
        <div className="row-actions">
          <button
            type="button"
            onClick={() => {
              if (!value) return;
              const res = onSave(value);
              if (res.ok) setEditing(false);
              else setError(t(`plan.adjustError.${res.error}`));
            }}
          >
            {t("plan.save")}
          </button>
          <button type="button" className="secondary" onClick={() => setEditing(false)}>
            {t("common.cancel")}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="part-row">
      <span>
        <span className="part-name">{name}</span>
        {(part.isFixed || part.isManual) && (
          <span className="field-hint">
            {" "}
            · {t(part.isFixed ? "plan.fixedHint" : "plan.manualHint")}
          </span>
        )}
      </span>
      <span className="part-amount" data-part={part.key}>
        {formatMoney(part.amount)}
      </span>
      {!part.isFixed && (
        <button
          type="button"
          className="link-button"
          aria-label={`${t("plan.edit")}: ${name}`}
          onClick={() => {
            setValue(part.amount);
            setError(undefined);
            setEditing(true);
          }}
        >
          {t("plan.edit")}
        </button>
      )}
    </li>
  );
}

/** FR-014–FR-017: monthly plan with parts, weekly limits, surplus rule and manual edits. */
export function Plan({
  plan,
  recommendedMethodId,
  overridden,
  onAdjust,
  onChangeMethod,
  onShowRecommendation,
  onEditAnswers,
  onShowHistory,
}: {
  plan: BudgetPlan;
  recommendedMethodId: MethodId | null;
  overridden: boolean;
  onAdjust: (key: PlanPartKey, amount: Money) => Result<unknown, AdjustError>;
  onChangeMethod: () => void;
  onShowRecommendation: () => void;
  onEditAnswers: () => void;
  onShowHistory: () => void;
}) {
  const period = `${t(`month.${plan.period.month}` as "month.1")} ${plan.period.year}`;
  const total = plan.parts.reduce((s, p) => s + p.amount.amount, 0);
  const isBase = plan.methodId === "base_plus_buffer";

  return (
    <StepLayout
      title={t("plan.title", { period })}
      footer={
        <>
          <button type="button" className="secondary" onClick={onChangeMethod}>
            {t("plan.changeMethod")}
          </button>
          <button type="button" className="secondary" onClick={onShowRecommendation}>
            {t("plan.toRecommendation")}
          </button>
          <button type="button" className="secondary" onClick={onEditAnswers}>
            {t("rec.editAnswers")}
          </button>
          <button type="button" className="secondary" onClick={onShowHistory}>
            {t("history.open")}
          </button>
        </>
      }
    >
      <p>
        <strong>{t("plan.method", { method: methodTitle(plan.methodId) })}</strong>
      </p>
      {overridden && recommendedMethodId && (
        <p className="field-hint">
          {t("plan.overridden", { method: methodTitle(recommendedMethodId) })}
        </p>
      )}
      <p>{t(isBase ? "plan.income.base" : "plan.income", { amount: formatMoney(plan.income) })}</p>

      {plan.warnings.length > 0 && (
        <ul className="warning-list" role="status">
          {plan.warnings.map((w) => (
            <li key={w}>{warningText(plan, w)}</li>
          ))}
        </ul>
      )}

      <section aria-labelledby="plan-parts">
        <h2 id="plan-parts">{t("plan.partsTitle")}</h2>
        <ul className="part-list">
          {plan.parts.map((p) => (
            <PartRow
              key={`${p.key}-${p.amount.amount}`}
              part={p}
              onSave={(amount) => onAdjust(p.key, amount)}
            />
          ))}
        </ul>
        <p className="plan-total">
          {t("plan.total", { amount: formatMoney(money(total, plan.income.currency)) })}
        </p>
      </section>

      {plan.weeklyLimits && (
        <section aria-labelledby="plan-weeks">
          <h2 id="plan-weeks">{t("plan.weeksTitle")}</h2>
          <table className="weeks-table">
            <tbody>
              {plan.weeklyLimits.map((w) => (
                <tr key={w.weekIndex}>
                  <th scope="row">{t("plan.week", { n: w.weekIndex })}</th>
                  <td>{t("plan.weekDates", { from: formatDay(w.from), to: formatDay(w.to) })}</td>
                  <td className="part-amount">{formatMoney(w.limit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {plan.surplusRule && (
        <section aria-labelledby="plan-surplus" className="notice">
          <h2 id="plan-surplus">{t("plan.surplusTitle")}</h2>
          <p>
            {t("plan.surplusText", {
              base: formatMoney(plan.income),
              buffer: formatBpPercent(plan.surplusRule.bufferBp),
              target: formatMoney(plan.surplusRule.bufferTarget),
              savings: formatBpPercent(plan.surplusRule.savingsBp),
              free: formatBpPercent(plan.surplusRule.freeBp),
            })}
          </p>
        </section>
      )}
    </StepLayout>
  );
}
