import { useState } from "react";
import type { LoadError } from "../../storage/repository";
import { StepLayout } from "../components/StepLayout";
import { t } from "../i18n/ru";

/** Errors where starting over is the only in-app recovery (import arrives with T059). */
const CAN_START_OVER: readonly LoadError[] = ["DECRYPT_FAILED", "KEY_MISSING", "SCHEMA_INVALID"];

export function StorageError({
  error,
  onStartOver,
}: {
  error: LoadError;
  onStartOver: () => void;
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
    </StepLayout>
  );
}
