import { useId, useState } from "react";
import type { AppState } from "../../storage/app-state";
import { parseImport } from "../../storage/export-import";
import { t } from "../i18n/ru";

/**
 * Import from an export file or pasted text (FR-021). Nothing is applied until the file is
 * valid and, when data would be replaced, the user confirms.
 */
export function ImportForm({
  needsConfirmation,
  onImport,
}: {
  needsConfirmation: boolean;
  onImport: (state: AppState) => Promise<void> | void;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<AppState | null>(null);
  const [done, setDone] = useState(false);

  async function apply(state: AppState) {
    setPending(null);
    await onImport(state);
    setDone(true);
  }

  function check() {
    setDone(false);
    if (text.trim() === "") return setError(t("data.importEmpty"));
    const res = parseImport(text);
    if (!res.ok) return setError(t(`data.importError.${res.error}`));
    setError(null);
    if (needsConfirmation) setPending(res.value);
    else void apply(res.value);
  }

  return (
    <div>
      <div className="field">
        <label htmlFor={`${id}-file`}>{t("data.importFile")}</label>
        <input
          id={`${id}-file`}
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) setText(await file.text());
          }}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-text`}>{t("data.importText")}</label>
        <textarea
          id={`${id}-text`}
          className="text-input"
          rows={4}
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => setText(e.target.value)}
        />
        {error && (
          <p id={`${id}-error`} className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {pending ? (
        <div className="row-actions" role="group" aria-label={t("data.importTitle")}>
          <p role="alert">{t("data.importConfirm")}</p>
          <button type="button" className="danger" onClick={() => void apply(pending)}>
            {t("common.confirm")}
          </button>
          <button type="button" className="secondary" onClick={() => setPending(null)}>
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        <button type="button" className="secondary" onClick={check}>
          {t("data.import")}
        </button>
      )}
      {done && <p role="status">{t("data.imported")}</p>}
    </div>
  );
}
