import { useId } from "react";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface ChoiceProps<T extends string> {
  legend: string;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | undefined;
}

/** Accessible radio group: native inputs inside a fieldset, keyboard arrows work by default. */
export function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
}: ChoiceProps<T>) {
  const name = useId();
  return (
    <fieldset className="field choice" aria-describedby={error ? `${name}-error` : undefined}>
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className="choice-option">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span>
            <span className="choice-label">{o.label}</span>
            {o.description && <span className="choice-description">{o.description}</span>}
          </span>
        </label>
      ))}
      {error && (
        <p id={`${name}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
