import { useEffect, useRef, type ReactNode } from "react";
import { t } from "../i18n/ru";

export interface StepLayoutProps {
  title: string;
  step?: { current: number; total: number };
  children: ReactNode;
  footer?: ReactNode;
}

/** Screen frame: moves focus to the heading on mount so screen readers announce the new step. */
export function StepLayout({ title, step, children, footer }: StepLayoutProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [title]);

  return (
    <main className="screen">
      {step && (
        <p className="step-indicator">
          {t("common.stepOf", { current: step.current, total: step.total })}
        </p>
      )}
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      <div className="screen-body">{children}</div>
      {footer && <div className="screen-footer">{footer}</div>}
    </main>
  );
}
