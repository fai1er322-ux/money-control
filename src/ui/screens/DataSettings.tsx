import { useState } from "react";
import type { AppState } from "../../storage/app-state";
import { createExport, exportFileName, serializeExport } from "../../storage/export-import";
import type { StorageMode } from "../../storage/repository";
import { ImportForm } from "../components/ImportForm";
import { StepLayout } from "../components/StepLayout";
import { t } from "../i18n/ru";
import { useTelegramClient } from "../telegram";

/**
 * Saves the export through a download link. Telegram's downloadFile needs an HTTPS URL of a
 * hosted file and cannot serve local data, so copying the text is the fallback inside Telegram.
 */
function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** FR-020a, FR-021: storage mode, export, import and full deletion. */
export function DataSettings({
  state,
  storageMode,
  onImport,
  onDeleteAll,
  onBack,
}: {
  state: AppState;
  storageMode: StorageMode;
  onImport: (state: AppState) => void;
  onDeleteAll: () => Promise<void>;
  onBack: () => void;
}) {
  const client = useTelegramClient();
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasData = state.profiles.length > 0 || state.draft !== null;
  const exportText = () => {
    const now = new Date().toISOString();
    return { now, text: serializeExport(createExport(state, now)) };
  };

  return (
    <StepLayout
      title={t("data.title")}
      footer={
        <button type="button" className="secondary" onClick={onBack}>
          {t("common.back")}
        </button>
      }
    >
      <section aria-labelledby="data-where">
        <h2 id="data-where">{t("data.where")}</h2>
        <p>{t("data.whereText", { mode: t(`storage.mode.${storageMode}`) })}</p>
        {/* Shown so the storage spike (T022) can record which mode each client gets. */}
        <p className="field-hint">{client ? t("data.client", client) : t("data.clientNone")}</p>
      </section>

      {hasData && (
        <section aria-labelledby="data-export">
          <h2 id="data-export">{t("data.exportTitle")}</h2>
          <p className="warning-text">{t("data.exportWarning")}</p>
          <div className="row-actions">
            <button
              type="button"
              onClick={() => {
                const { now, text } = exportText();
                download(text, exportFileName(now));
              }}
            >
              {t("data.download")}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(exportText().text);
                  setCopyStatus("copied");
                } catch {
                  setCopyStatus("failed");
                }
              }}
            >
              {t("data.copy")}
            </button>
          </div>
          {copyStatus && (
            <p role="status">{t(copyStatus === "copied" ? "data.copied" : "data.copyFailed")}</p>
          )}
          {copyStatus === "failed" && (
            <textarea
              className="text-input"
              aria-label={t("data.exportText")}
              readOnly
              rows={6}
              value={exportText().text}
            />
          )}
        </section>
      )}

      <section aria-labelledby="data-import">
        <h2 id="data-import">{t("data.importTitle")}</h2>
        <ImportForm needsConfirmation={hasData} onImport={onImport} />
      </section>

      {hasData && (
        <section aria-labelledby="data-delete">
          <h2 id="data-delete">{t("data.deleteTitle")}</h2>
          {confirmDelete ? (
            <div className="row-actions">
              <p role="alert">{t("data.deleteConfirm")}</p>
              <button type="button" className="danger" onClick={() => void onDeleteAll()}>
                {t("common.confirm")}
              </button>
              <button type="button" className="secondary" onClick={() => setConfirmDelete(false)}>
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
              {t("data.delete")}
            </button>
          )}
        </section>
      )}
    </StepLayout>
  );
}
