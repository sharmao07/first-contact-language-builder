import { z } from "zod";

export const analysisSchema = z.object({
  observations: z.array(z.string().trim().min(1).max(400)).max(8),
  inferences: z.array(z.string().trim().min(1).max(400)).max(8).optional().default([]),
  cannotDetermine: z.array(z.string().trim().min(1).max(400)).max(8).optional().default([]),
  ambiguities: z.array(z.string().trim().min(1).max(400)).max(8),
  followUps: z.array(z.string().trim().min(1).max(400)).max(6),
  hypotheses: z
    .array(
      z.object({
        proposedMeaning: z.string().trim().min(1).max(200),
        explanation: z.string().trim().min(1).max(1200),
        supportingEvidence: z.string().trim().min(1).max(800),
        alternatives: z.string().trim().max(800),
        missingInformation: z.string().trim().max(800).optional().default(""),
        culturalAmbiguity: z.string().trim().max(800).optional().default(""),
        confidence: z.number().min(0).max(1),
        suggestedExperiment: z.string().trim().min(1).max(800),
      }),
    )
    .min(2)
    .max(6),
});

export type AnalysisJson = z.infer<typeof analysisSchema>;
