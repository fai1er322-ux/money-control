/**
 * AppState — the single persisted unit (data-model.md «AppState»).
 * Entity schemas are intentionally loose here (`id` only) and are tightened when the domain
 * schemas land in US1–US3 (tasks T028, T042+); unknown fields are preserved, not dropped.
 */
import { z } from "zod";
import { err, ok, type Result } from "../domain/result";

export const CURRENT_SCHEMA_VERSION = 1;

const entity = z.looseObject({ id: z.string() });

export const appStateSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  profiles: z.array(entity),
  draft: z.looseObject({}).nullable(),
  recommendations: z.array(entity),
  plans: z.array(entity),
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
