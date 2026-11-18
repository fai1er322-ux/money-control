import type { MethodId } from "../../domain/methods/catalog";
import type { Recommendation } from "../../domain/recommendation";
import { StepLayout } from "../components/StepLayout";
import { formatMoney } from "../i18n/format";
import { t } from "../i18n/ru";

const methodTitle = (id: MethodId) => t(`method.${id}.title`);
const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

function decisionText(rec: Recommendation): string | null {
  if (rec.mode === "deficit") return null;
  if (rec.decision === "overridden" && rec.chosenMethodId) {
    return t("history.decision.overridden", { method: methodTitle(rec.chosenMethodId) });
  }
  return t(`history.decision.${rec.decision}`);
}

/** FR-018: every past recommendation with its date, rules version and the user's decision. */
export function History({
  recommendations,
  onBack,
}: {
  recommendations: readonly Recommendation[];
  onBack: () => void;
}) {
  const newestFirst = [...recommendations].reverse();
  return (
    <StepLayout
      title={t("history.title")}
      footer={
        <button type="button" className="secondary" onClick={onBack}>
          {t("common.back")}
        </button>
      }
    >
      <ol className="history-list" reversed>
        {newestFirst.map((rec, i) => {
          const decision = decisionText(rec);
          return (
            <li key={rec.id} className="method-card">
              <p className="field-hint">
                <time dateTime={rec.createdAt}>{dateFormat.format(new Date(rec.createdAt))}</time>
                {" · "}
                {t("history.rules", { version: rec.rulesVersion })}
                {i === 0 && (
                  <>
                    {" · "}
                    <strong>{t("history.current")}</strong>
                  </>
                )}
              </p>
              <h2>
                {rec.recommendedMethodId
                  ? methodTitle(rec.recommendedMethodId)
                  : t("history.deficit", {
                      amount: rec.deficit ? formatMoney(rec.deficit) : "",
                    })}
              </h2>
              {decision && <p>{decision}</p>}
            </li>
          );
        })}
      </ol>
    </StepLayout>
  );
}
