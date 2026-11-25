import { z } from "zod";
import { EXPERIMENT_TYPES } from "@/lib/constants";

export const SIMULATED_PLAN_NOTE = "Simulated experiment recommendation — no model analyzed this session.";

export const CHECKLIST_MEASURES =
  "Checklist only, not information gain and not a claim of optimality. Two points if the check names at least two readings. One point if the stimulus is new. One point if this experiment type has not been used. One point if it can be done from stored evidence or with no file. Two points are removed when both the type and the stimulus were already used.";

export const outcomeCellSchema = z.object({
  meaning: z.string().trim().min(1).max(200),
  expectation: z.string().trim().min(1).max(300),
});

export const plannedOutcomeSchema = z.object({
  outcome: z.string().trim().min(1).max(300),
  expectedUnder: z.array(outcomeCellSchema).min(1).max(6),
  supports: z.string().trim().min(1).max(300),
  weakens: z.string().trim().min(1).max(300),
  distinguishes: z.boolean(),
  remainingAmbiguity: z.string().trim().min(1).max(400),
});

export const recommendationSchema = z.object({
  title: z.string().trim().min(1).max(160),
  researchQuestion: z.string().trim().min(1).max(400),
  competingMeanings: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
  hypothesisIds: z.array(z.string().trim().min(1)).max(8),
  experimentType: z.enum(EXPERIMENT_TYPES),
  stimuli: z.array(z.string().trim().min(1).max(200)).min(1).max(6),
  procedure: z.string().trim().min(1).max(1200),
  neutralPrompt: z.string().trim().min(1).max(800),
  outcomes: z.array(plannedOutcomeSchema).min(2).max(5),
  remainingAmbiguity: z.string().trim().min(1).max(500),
  usefulness: z.string().trim().min(1).max(500),
  limitations: z.string().trim().min(1).max(500),
  evidenceRefs: z.array(z.string().trim().min(1)).max(12),
  rationale: z.string().trim().min(1).max(800),
  reviewState: z.enum(["draft", "ready"]).optional(),
  heuristic: z.object({
    score: z.number().int().min(-5).max(8),
    measures: z.string().trim().min(1).max(400),
  }),
  quality: z.object({
    passed: z.number().int().min(0).max(8),
    weak: z.boolean(),
    checks: z.array(z.object({
      name: z.string().min(1).max(80),
      status: z.enum(["pass", "weak", "fail"]),
      reason: z.string().min(1).max(300),
    })).length(8),
    note: z.string().min(1).max(400),
  }).optional(),
});

export const hypothesisAnalysisSchema = z.object({
  id: z.string(),
  meaning: z.string(),
  status: z.string(),
  supporting: z.array(z.string()).max(8),
  contradictory: z.array(z.string()).max(8),
  missing: z.string(),
  ambiguity: z.string(),
  distinguishing: z.string(),
  needsInput: z.boolean(),
});

export const experimentPlanSchema = z.object({
  simulated: z.boolean(),
  source: z.enum(["rules", "ai"]),
  providerNote: z.string().trim().min(1).max(500),
  sufficient: z.boolean(),
  insufficientReason: z.string().max(800),
  inspection: z.string().trim().min(1).max(400),
  analyses: z.array(hypothesisAnalysisSchema).max(8),
  overlaps: z.array(z.object({
    meanings: z.array(z.string().min(1)).min(2).max(6),
    reason: z.string().min(1).max(400),
  })).max(6),
  recommendations: z.array(recommendationSchema).max(3),
}).superRefine((plan, ctx) => {
  if (plan.sufficient && plan.recommendations.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A sufficient plan needs a recommendation." });
  }
  if (!plan.sufficient && plan.recommendations.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "An insufficient plan must not include a recommendation." });
  }
});

export type Recommendation = z.infer<typeof recommendationSchema>;
export type ExperimentPlan = z.infer<typeof experimentPlanSchema>;
export type HypothesisAnalysis = z.infer<typeof hypothesisAnalysisSchema>;

export const INSPECTION_NOTE = "The planner used written descriptions, labels, and recorded readings. It did not inspect image, audio, or video bytes.";
