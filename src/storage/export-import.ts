/**
 * Export / import file (FR-021, contracts/export-file.schema.json, research.md R7).
 * The file is plain JSON, not encrypted — the UI warns about that before export.
 * Import is all-or-nothing: an invalid file never changes the current data.
 */
import { z } from "zod";
import { err, ok, type Result } from "../domain/result";
import { appStateSchema, type AppState } from "./app-state";

export const EXPORT_APP = "money-control";
export const EXPORT_FORMAT = 1;

export const exportFileSchema = z.strictObject({
  app: z.literal(EXPORT_APP),
  exportFormat: z.literal(EXPORT_FORMAT),
  exportedAt: z.iso.datetime(),
  rulesVersions: z.array(z.string().regex(/^\d+\.\d+\.\d+$/)).optional(),
  state: appStateSchema,
});

export type ExportFile = z.infer<typeof exportFileSchema>;

export type ImportError = "NOT_JSON" | "NOT_MONEY_CONTROL" | "UNSUPPORTED_FORMAT" | "INVALID_DATA";

export function createExport(state: AppState, now: string): ExportFile {
  const rulesVersions = [...new Set(state.recommendations.map((r) => r.rulesVersion))].sort();
  return { app: EXPORT_APP, exportFormat: EXPORT_FORMAT, exportedAt: now, rulesVersions, state };
}

export function serializeExport(file: ExportFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** money-control-2026-12-10.json */
export function exportFileName(now: string): string {
  return `money-control-${now.slice(0, 10)}.json`;
}

/** Every reference inside the state points at an existing entity. */
function isConsistent(state: AppState): boolean {
  const profiles = new Set(state.profiles.map((p) => p.id));
  const recommendations = new Set(state.recommendations.map((r) => r.id));
  const plans = new Set(state.plans.map((p) => p.id));
  return (
    state.recommendations.every((r) => profiles.has(r.profileId)) &&
    state.plans.every((p) => recommendations.has(p.recommendationId)) &&
    (state.activePlanId === null || plans.has(state.activePlanId))
  );
}

export function parseImport(text: string): Result<AppState, ImportError> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err("NOT_JSON");
  }
  if (typeof raw !== "object" || raw === null || (raw as { app?: unknown }).app !== EXPORT_APP) {
    return err("NOT_MONEY_CONTROL");
  }
  if ((raw as { exportFormat?: unknown }).exportFormat !== EXPORT_FORMAT) {
    return err("UNSUPPORTED_FORMAT");
  }
  const parsed = exportFileSchema.safeParse(raw);
  if (!parsed.success || !isConsistent(parsed.data.state)) return err("INVALID_DATA");
  return ok(parsed.data.state);
}
