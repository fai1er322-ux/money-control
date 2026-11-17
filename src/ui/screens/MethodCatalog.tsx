import { METHODS, type MethodId } from "../../domain/methods/catalog";
import { StepLayout } from "../components/StepLayout";
import { t } from "../i18n/ru";

/** FR-013: any method of the catalog can be chosen instead of the recommended one. */
export function MethodCatalog({
  recommendedMethodId,
  currentMethodId,
  onChoose,
  onBack,
}: {
  recommendedMethodId: MethodId;
  currentMethodId: MethodId | null;
  onChoose: (id: MethodId) => void;
  onBack: () => void;
}) {
  return (
    <StepLayout
      title={t("catalog.title")}
      footer={
        <button type="button" className="secondary" onClick={onBack}>
          {t("common.back")}
        </button>
      }
    >
      <ul className="method-list">
        {METHODS.map((m) => {
          const title = t(`method.${m.id}.title`);
          return (
            <li key={m.id} className="method-card">
              <h2>{title}</h2>
              {m.id === recommendedMethodId && <p className="badge">{t("catalog.recommended")}</p>}
              {m.id === currentMethodId && <p className="badge">{t("catalog.current")}</p>}
              <p>{t(`method.${m.id}.description`)}</p>
              <button type="button" className="secondary" onClick={() => onChoose(m.id)}>
                {t("catalog.choose", { method: title })}
              </button>
            </li>
          );
        })}
      </ul>
    </StepLayout>
  );
}
