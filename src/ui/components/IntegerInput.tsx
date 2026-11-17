import { useId, useState } from "react";
import { t } from "../i18n/ru";

export interface IntegerInputProps {
  label: string;
  hint?: string;
  value: number | null;
  /** Called with a whole number, or null when the field is empty. Not called on invalid input. */
  onChange: (value: number | null) => void;
  error?: string | undefined;
}

/** Whole-number input (e.g. number of dependents); range checks come from the domain. */
export function IntegerInput({ label, hint, value, onChange, error }: IntegerInputProps) {
  const id = useId();
  const [text, setText] = useState(value === null ? "" : String(value));
  const [parseError, setParseError] = useState<string | null>(null);
  const shownError = parseError ?? error;
  const describedBy = [hint ? `${id}-hint` : null, shownError ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      <input
        id={id}
        className="text-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const trimmed = next.trim();
          if (trimmed === "") {
            setParseError(null);
            onChange(null);
          } else if (/^\d{1,6}$/.test(trimmed)) {
            setParseError(null);
            onChange(Number(trimmed));
          } else {
            setParseError(t("integer.error.NOT_AN_INTEGER"));
          }
        }}
      />
      {shownError && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {shownError}
        </p>
      )}
    </div>
  );
}
