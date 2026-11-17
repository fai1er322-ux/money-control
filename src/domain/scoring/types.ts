import type { ProfileMetrics } from "../metrics";
import type { MethodId } from "../methods/catalog";
import type { FinancialProfile } from "../profile";

export interface ScoringContext {
  profile: FinancialProfile;
  metrics: ProfileMetrics;
}

export interface ScoringRule {
  id: string;
  condition: (ctx: ScoringContext) => boolean;
  points: Partial<Record<MethodId, number>>;
  /** i18n key of the explanation shown as a recommendation factor. */
  explanationKey: string;
  /** Numbers for the explanation text (shares in bp, months ×10, …); formatted by the UI. */
  params?: (ctx: ScoringContext) => Record<string, number>;
}

export interface ScoringRuleSet {
  version: string;
  rules: readonly ScoringRule[];
}
