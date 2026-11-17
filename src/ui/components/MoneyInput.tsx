import { useId, useState } from "react";
import { money, type Currency, type Money } from "../../domain/money";
import { parseRublesToKopecks } from "../i18n/format";
import { t, type MessageKey } from "../i18n/ru";

export interface MoneyInputProps {
  label: string;
  hint?: string;
  value: Money | null;
  currency?: Currency;
  /** Called with a valid amount, or null when the field is empty. Not called on invalid input. */
  onChange: (value: Money | null) => void;
  /** Validation error coming from the domain (e.g. "min must not exceed average"). */
  error?: string | undefined;
  required?: boolean;
}

function toInputText(m: Money | null): string {
  if (m === null) return "";
  const whole = Math.trunc(m.amount / 100);
  const kop = m.amount % 100;
  return kop === 0 ? String(whole) : `${whole},${String(kop).padStart(2, "0")}`;
}

/** Ruble input that stores integer kopecks; never converts through floating point. */
export function MoneyInput({
  label,
  hint,
  value,
  currency = "RUB",
  onChange,
  error,
  required,
}: MoneyInputProps) {
  const id = useId();
  const [text, setText] = useState(() => toInputText(value));
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
      <div className="money-input">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          required={required}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => {
            setText(e.target.value);
            const parsed = parseRublesToKopecks(e.target.value);
            if (parsed.ok) {
              setParseError(null);
              onChange(parsed.value === null ? null : money(parsed.value, currency));
            } else {
              setParseError(t(`money.error.${parsed.error}` as MessageKey));
            }
          }}
        />
        <span aria-hidden="true">₽</span>
      </div>
      {shownError && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {shownError}
        </p>
      )}
    </div>
  );
}
