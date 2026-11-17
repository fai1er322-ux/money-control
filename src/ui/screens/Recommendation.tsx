import type { MethodId } from "../../domain/methods/catalog";
import type { Recommendation as RecommendationModel } from "../../domain/recommendation";
import { Disclaimer } from "../components/Disclaimer";
import { StepLayout } from "../components/StepLayout";
import { displayParams, formatMoney } from "../i18n/format";
import { t, type MessageKey } from "../i18n/ru";
import { BottomActions } from "../telegram";

const methodTitle = (id: MethodId) => t(`method.${id}.title`);
const methodDescription = (id: MethodId) => t(`method.${id}.description`);

/** FR-009, FR-011, FR-012: the recommended method with its reasons, or the deficit mode. */
export function Recommendation({
  recommendation: rec,
  onEditAnswers,
  onAccept,
  onChooseOther,
  onOpenPlan,
}: {
  recommendation: RecommendationModel;
  onEditAnswers: () => void;
  /** FR-013: accept the recommended method and build the plan. */
  onAccept: () => void;
  onChooseOther: () => void;
  /** Present when a plan for this recommendation already exists. */
  onOpenPlan?: (() => void) | undefined;
}) {
  const editButton = (
    <button type="button" className="secondary" onClick={onEditAnswers}>
      {t("rec.editAnswers")}
    </button>
  );

  if (rec.mode === "deficit" || !rec.recommendedMethodId) {
    return (
      <StepLayout title={t("deficit.title")} footer={editButton}>
        <p>{t("deficit.lead", { amount: rec.deficit ? formatMoney(rec.deficit) : "" })}</p>
        <h2>{t("deficit.stepsTitle")}</h2>
        <ol className="steps-list">
          <li>{t("deficit.step1")}</li>
          <li>{t("deficit.step2")}</li>
          <li>{t("deficit.step3")}</li>
          <li>{t("deficit.step4")}</li>
        </ol>
      </StepLayout>
    );
  }

  const recommended = rec.recommendedMethodId;
  const alternative = rec.alternativeMethodId;
  const primary =
    rec.decision === "pending" || !onOpenPlan
      ? { label: t("rec.accept"), onClick: onAccept }
      : { label: t("rec.openPlan"), onClick: onOpenPlan };
  const footer = (
    <>
      <BottomActions primary={primary} />
      <button type="button" className="secondary" onClick={onChooseOther}>
        {t("rec.chooseOther")}
      </button>
      {editButton}
    </>
  );

  return (
    <StepLayout title={t("rec.title", { method: methodTitle(recommended) })} footer={footer}>
      <p>{methodDescription(recommended)}</p>
      <p className="field-hint">{t("rec.score", { score: rec.scores[recommended] ?? 0 })}</p>

      <section aria-labelledby="rec-why">
        <h2 id="rec-why">{t("rec.why")}</h2>
        <ul className="factor-list">
          {rec.factors.map((f) => (
            <li key={f.ruleId}>
              <span>{t(f.explanationKey as MessageKey, displayParams(f.params))}</span>
              <span
                className="factor-points"
                aria-label={t("rec.factorPointsLabel", { points: f.points })}
              >
                {t("rec.factorPoints", { points: f.points })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {alternative && (
        <section aria-labelledby="rec-alt" className="notice">
          <h2 id="rec-alt">{t("rec.alternative")}</h2>
          <p>
            <strong>{methodTitle(alternative)}</strong>{" "}
            <span className="field-hint">
              ({t("rec.score", { score: rec.scores[alternative] ?? 0 })})
            </span>
          </p>
          <p>{methodDescription(alternative)}</p>
        </section>
      )}

      <Disclaimer />
      <p className="field-hint">{t("rec.rulesVersion", { version: rec.rulesVersion })}</p>
    </StepLayout>
  );
}
