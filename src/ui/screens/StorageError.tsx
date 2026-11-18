import { useState } from "react";
import type { AppState } from "../../storage/app-state";
import type { LoadError } from "../../storage/repository";
import { ImportForm } from "../components/ImportForm";
import { StepLayout } from "../components/StepLayout";
import { t } from "../i18n/ru";

/** Errors where the stored data is unusable: restore from an export file or start over. */
const CAN_START_OVER: readonly LoadError[] = ["DECRYPT_FAILED", "KEY_MISSING", "SCHEMA_INVALID"];

export function StorageError({
  error,
  onStartOver,
  onImport,
}: {
  error: LoadError;
  onStartOver: () => void;
  /** Replaces the unreadable data with the imported state. */
  onImport: (state: AppState) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const canStartOver = CAN_START_OVER.includes(error);

  return (
    <StepLayout
      title={t("storage.error.title")}
      footer={
        canStartOver &&
        (confirming ? (
          <>
            <p role="alert">{t("storage.error.startOverConfirm")}</p>
            <button type="button" className="danger" onClick={onStartOver}>
              {t("common.confirm")}
            </button>
            <button type="button" className="secondary" onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </button>
          </>
        ) : (
          <button type="button" className="secondary" onClick={() => setConfirming(true)}>
            {t("storage.error.startOver")}
          </button>
        ))
      }
    >
      <p>{t(`storage.error.${error}`)}</p>
      {canStartOver && (
        <section aria-labelledby="storage-import">
          <h2 id="storage-import">{t("data.importTitle")}</h2>
          <ImportForm needsConfirmation onImport={onImport} />
        </section>
      )}
    </StepLayout>
  );
}
