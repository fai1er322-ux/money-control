import { t } from "../i18n/ru";

/** FR-011: recommendations are informational, not personal investment advice. */
export function Disclaimer() {
  return (
    <p className="disclaimer" role="note">
      {t("disclaimer.text")}
    </p>
  );
}
