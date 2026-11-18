import type { StorageMode } from "../../storage/repository";
import { StepLayout } from "../components/StepLayout";
import { t } from "../i18n/ru";
import { BottomActions } from "../telegram";

/** First screen with the local-storage notice (FR-020a). */
export function Welcome({
  storageMode,
  onStart,
  onImport,
}: {
  storageMode: StorageMode;
  onStart: () => void;
  /** Restore from an export file, e.g. on a new device (FR-021). */
  onImport: () => void;
}) {
  return (
    <StepLayout
      title={t("app.title")}
      footer={
        <>
          <BottomActions primary={{ label: t("welcome.start"), onClick: onStart }} />
          <button type="button" className="secondary" onClick={onImport}>
            {t("welcome.import")}
          </button>
        </>
      }
    >
      <p>{t("welcome.lead")}</p>
      <section className="notice" aria-labelledby="storage-notice-title">
        <h2 id="storage-notice-title">{t("welcome.storageTitle")}</h2>
        <p>{t("welcome.storageNotice", { mode: t(`storage.mode.${storageMode}`) })}</p>
      </section>
    </StepLayout>
  );
}
