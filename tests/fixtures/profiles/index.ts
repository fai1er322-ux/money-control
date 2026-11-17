/**
 * Reference profiles E1–E4 from contracts/scoring-rules-v1.md §4, amounts in kopecks.
 * Each fixture holds the questionnaire input and the expected metrics and recommendation.
 */
import e1 from "./e1-stable-salary.json";
import e2 from "./e2-freelancer.json";
import e3 from "./e3-high-debt.json";
import e4 from "./e4-deficit.json";

export const REFERENCE_PROFILES = [e1, e2, e3, e4] as const;
export { e1, e2, e3, e4 };
