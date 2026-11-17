/** Recommendation entity (data-model.md «Recommendation»). */
import { z } from "zod";
import { METHOD_IDS } from "./methods/catalog";
import { moneySchema } from "./profile";

const methodId = z.enum(METHOD_IDS);

export const recommendationFactorSchema = z.object({
  ruleId: z.string(),
  points: z.number().int(),
  explanationKey: z.string(),
  params: z.record(z.string(), z.number()),
});

export const recommendationSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  profileId: z.string(),
  rulesVersion: z.string(),
  mode: z.enum(["normal", "deficit"]),
  scores: z.partialRecord(methodId, z.number().int()),
  recommendedMethodId: methodId.nullable(),
  alternativeMethodId: methodId.nullable(),
  /** Up to 4 rules with the largest contribution to the recommended method (FR-009). */
  factors: z.array(recommendationFactorSchema).max(4),
  deficit: moneySchema.nullable(),
  decision: z.enum(["pending", "accepted", "overridden"]),
  chosenMethodId: methodId.nullable(),
  decidedAt: z.iso.datetime().nullable(),
});

export type RecommendationFactor = z.infer<typeof recommendationFactorSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
