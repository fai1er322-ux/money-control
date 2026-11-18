import { IDBFactory } from "fake-indexeddb";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPlan } from "../../src/domain/methods/build-plan";
import { createProfile, type FinancialProfileInput } from "../../src/domain/profile";
import { recommend } from "../../src/domain/scoring/engine";
import { SCORING_RULES_V1 } from "../../src/domain/scoring/rules-v1";
import { emptyAppState, type AppState } from "../../src/storage/app-state";
import {
  createExport,
  exportFileName,
  parseImport,
  serializeExport,
} from "../../src/storage/export-import";
import { createRepository } from "../../src/storage/repository";
import { e1, e3 } from "../fixtures/profiles";

const NOW = "2026-12-10T09:00:00.000Z";

function sampleState(): AppState {
  const ctx = { now: NOW, newId: () => crypto.randomUUID() };
  const p1 = createProfile(e3.input as FinancialProfileInput, ctx);
  const r1 = recommend(p1, SCORING_RULES_V1, ctx);
  const p2 = createProfile(e1.input as FinancialProfileInput, ctx);
  const r2 = { ...recommend(p2, SCORING_RULES_V1, ctx), decision: "accepted" as const };
  const plan = buildPlan(
    p2,
    "rule_50_30_20",
    { year: 2026, month: 12 },
    {
      ...ctx,
      recommendationId: r2.id,
    },
  );
  return {
    ...emptyAppState(),
    profiles: [p1, p2],
    recommendations: [r1, r2],
    plans: [plan],
    activePlanId: plan.id,
    localStorageNoticeAcknowledgedAt: NOW,
  };
}

/** Minimal JSON Schema 2020-12 checker for the subset used by the contract file. */
function checkAgainstSchema(
  value: unknown,
  schema: Record<string, unknown>,
  root: Record<string, unknown>,
  path = "$",
): string[] {
  const s = schema.$ref
    ? (root.$defs as Record<string, Record<string, unknown>>)[
        (schema.$ref as string).split("/").pop()!
      ]!
    : schema;
  const errors: string[] = [];
  if ("const" in s && value !== s.const) errors.push(`${path}: const`);
  if (s.enum && !(s.enum as unknown[]).includes(value)) errors.push(`${path}: enum`);
  if (s.oneOf) {
    const ok = (s.oneOf as Record<string, unknown>[]).filter(
      (o) => checkAgainstSchema(value, o, root, path).length === 0,
    );
    if (ok.length !== 1) errors.push(`${path}: oneOf`);
  }
  const types = s.type ? ([] as string[]).concat(s.type as string) : null;
  if (types) {
    const actual =
      value === null
        ? "null"
        : Array.isArray(value)
          ? "array"
          : Number.isInteger(value)
            ? "integer"
            : typeof value;
    const matches = types.some((t) => t === actual || (t === "number" && actual === "integer"));
    if (!matches) return [...errors, `${path}: type ${actual} not in ${types.join("|")}`];
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const r of (s.required as string[] | undefined) ?? []) {
      if (!(r in obj)) errors.push(`${path}.${r}: required`);
    }
    const props = (s.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
    for (const [k, v] of Object.entries(obj)) {
      if (props[k]) errors.push(...checkAgainstSchema(v, props[k], root, `${path}.${k}`));
      else if (s.additionalProperties === false) errors.push(`${path}.${k}: additional`);
    }
  }
  if (Array.isArray(value) && s.items) {
    value.forEach((v, i) =>
      errors.push(
        ...checkAgainstSchema(v, s.items as Record<string, unknown>, root, `${path}[${i}]`),
      ),
    );
  }
  if (
    typeof s.pattern === "string" &&
    typeof value === "string" &&
    !new RegExp(s.pattern).test(value)
  ) {
    errors.push(`${path}: pattern`);
  }
  return errors;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("network is forbidden"))),
  );
});

describe("export file", () => {
  it("matches contracts/export-file.schema.json", () => {
    const schema = JSON.parse(
      readFileSync(
        "specs/001-budget-method-recommendation/contracts/export-file.schema.json",
        "utf8",
      ),
    ) as Record<string, unknown>;
    const file = JSON.parse(serializeExport(createExport(sampleState(), NOW)));
    expect(checkAgainstSchema(file, schema, schema)).toEqual([]);
    expect(file.rulesVersions).toEqual(["1.0.0"]);
  });

  it("is named after the export date", () => {
    expect(exportFileName(NOW)).toBe("money-control-2026-12-10.json");
  });

  it("round-trips through export → wipe → import → encrypted storage", async () => {
    const repo = await createRepository(null);
    const state = sampleState();
    await repo.save(state);
    const text = serializeExport(createExport(state, NOW));

    await repo.wipe();
    expect(await repo.load()).toEqual({ ok: true, value: null });

    const imported = parseImport(text);
    expect(imported).toEqual({ ok: true, value: state });
    await repo.save(imported.ok ? imported.value : emptyAppState());
    expect(await repo.load()).toEqual({ ok: true, value: state });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("parseImport rejects bad files without touching data", () => {
  const valid = () => JSON.parse(serializeExport(createExport(sampleState(), NOW)));

  it.each([
    ["not JSON", "{oops", "NOT_JSON"],
    ["a foreign JSON file", JSON.stringify({ hello: "world" }), "NOT_MONEY_CONTROL"],
    ["a future format", JSON.stringify({ ...valid(), exportFormat: 2 }), "UNSUPPORTED_FORMAT"],
    [
      "a negative income",
      JSON.stringify(
        (() => {
          const f = valid();
          f.state.profiles[0].monthlyIncome.amount = -1;
          return f;
        })(),
      ),
      "INVALID_DATA",
    ],
    [
      "a dangling active plan",
      JSON.stringify({ ...valid(), state: { ...valid().state, activePlanId: "missing" } }),
      "INVALID_DATA",
    ],
    ["unknown top-level fields", JSON.stringify({ ...valid(), extra: 1 }), "INVALID_DATA"],
  ])("%s", async (_name, text, error) => {
    const repo = await createRepository(null);
    const state = sampleState();
    await repo.save(state);
    expect(parseImport(text)).toEqual({ ok: false, error });
    expect(await repo.load()).toEqual({ ok: true, value: state });
  });
});
