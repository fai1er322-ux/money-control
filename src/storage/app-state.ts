/**
 * AppState — the single persisted unit (data-model.md «AppState»).
 * Every entity is validated with its domain schema, so corrupted or foreign data is rejected
 * as SCHEMA_INVALID instead of reaching the UI.
 */
import { z } from "zod";
import { budgetPlanSchema } from "../domain/plan";
import { financialProfileSchema, questionnaireDraftSchema } from "../domain/profile";
import { recommendationSchema } from "../domain/recommendation";
import { err, ok, type Result } from "../domain/result";

export const CURRENT_SCHEMA_VERSION = 1;

export const appStateSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  profiles: z.array(financialProfileSchema),
  draft: questionnaireDraftSchema.nullable(),
  recommendations: z.array(recommendationSchema),
  plans: z.array(budgetPlanSchema),
  activePlanId: z.string().nullable(),
  localStorageNoticeAcknowledgedAt: z.iso.datetime().nullable(),
});

export type AppState = z.infer<typeof appStateSchema>;

export function emptyAppState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profiles: [],
    draft: null,
    recommendations: [],
    plans: [],
    activePlanId: null,
    localStorageNoticeAcknowledgedAt: null,
  };
}

/**
 * Validates and upgrades a decrypted payload to the current schema.
 * Future schema versions add a migration step per version here.
 */
export function migrate(raw: unknown): Result<AppState, "SCHEMA_INVALID"> {
  const parsed = appStateSchema.safeParse(raw);
  return parsed.success ? ok(parsed.data) : err("SCHEMA_INVALID");
}
