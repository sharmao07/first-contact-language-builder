import { z } from "zod";
import {
  ACTION_CATEGORIES,
  ACTIVITY_TYPES,
  CATEGORIES,
  EVIDENCE_TYPES,
  EXPERIMENT_TYPES,
  RELATION_TYPES,
  RESULT_VALUES,
} from "@/lib/constants";

export const displayNameSchema = z.string().trim().min(1, "Enter a display name.").max(40, "Use a display name under 40 characters.");
export const roleSchema = z.enum(["A", "B"]);

export const createSessionSchema = z.object({
  name: z.string().trim().min(1, "Name the session.").max(80, "Use a shorter session name."),
  description: z.string().trim().max(2000).optional().default(""),
  objective: z.string().trim().max(2000).optional().default(""),
  displayName: displayNameSchema,
  role: roleSchema.default("A"),
  purpose: z.enum(["community", "research", "general"]).optional().default("general"),
  communityRole: z.enum(["facilitator", "participant"]).optional(),
  consent: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  if (value.purpose === "community" && !value.consent) {
    context.addIssue({
      code: "custom",
      message: "Confirm that this session is for shared discovery, not emergency or professional interpretation.",
      path: ["consent"],
    });
  }
});

export const sessionPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  objective: z.string().trim().max(2000).optional(),
  action: z.enum(["archive", "restore"]).optional(),
});

export const joinSessionSchema = z.object({
  code: z.string().trim().toUpperCase(),
  displayName: displayNameSchema,
  role: roleSchema,
});

export const rejoinSessionSchema = z.object({
  code: z.string().trim().toUpperCase(),
  token: z.string().trim().min(8, "Enter the recovery key."),
  displayName: displayNameSchema.optional(),
});

export const evidenceFieldsSchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  description: z.string().trim().max(2000).optional().default(""),
  notes: z.string().trim().max(4000).optional().default(""),
  actionCategory: z.enum(ACTION_CATEGORIES).optional().nullable(),
  conceptId: z.string().trim().optional().nullable(),
  stance: z.enum(["observation", "participant_interpretation", "confirmatory", "contradictory"]).optional().default("observation"),
  consentToAnalyze: z.boolean().optional().default(false),
  durationMs: z.number().int().positive().max(600_000).optional().nullable(),
  qualityNote: z.string().trim().max(500).optional().default(""),
  annotation: z.string().trim().max(1000).optional().default(""),
  parentEvidenceId: z.string().trim().optional().nullable(),
  gestureDirection: z.string().trim().max(80).optional().default(""),
  gestureRepetition: z.string().trim().max(80).optional().default(""),
  gestureBody: z.string().trim().max(200).optional().default(""),
});

export const analyzeSchema = z.object({
  evidenceId: z.string().trim().min(1),
});

export const participantHypothesisSchema = z.object({
  proposedMeaning: z.string().trim().min(1, "Describe the proposed meaning.").max(200),
  explanation: z.string().trim().min(1, "Add an explanation.").max(1200),
  alternatives: z.string().trim().max(800).optional().default(""),
  suggestedExperiment: z.string().trim().max(800).optional().default(""),
  evidenceId: z.string().trim().optional().nullable(),
  conceptId: z.string().trim().optional().nullable(),
});

export const hypothesisResponseSchema = z.object({
  action: z.enum(["accept", "reject", "challenge"]),
  category: z.enum(CATEGORIES).optional(),
  meaning: z.string().trim().max(200).optional(),
  conceptId: z.string().trim().optional().nullable(),
  note: z.string().trim().max(2000).optional().default(""),
});

export const conceptCreateSchema = z.object({
  agreedMeaning: z.string().trim().min(1, "Enter the proposed meaning.").max(200),
  category: z.enum(CATEGORIES),
  contextualNotes: z.string().trim().max(4000).optional().default(""),
  exampleSituations: z.string().trim().max(4000).optional().default(""),
  alternativeInterpretations: z.string().trim().max(4000).optional().default(""),
});

export const conceptPatchSchema = z.object({
  agreedMeaning: z.string().trim().min(1).max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
  contextualNotes: z.string().trim().max(4000).optional(),
  exampleSituations: z.string().trim().max(4000).optional(),
  alternativeInterpretations: z.string().trim().max(4000).optional(),
  action: z.enum(["dispute", "archive", "restore", "recompute"]).optional(),
});

export const experimentCreateSchema = z.object({
  conceptId: z.string().trim().min(1),
  type: z.enum(EXPERIMENT_TYPES),
  stimulusNote: z.string().trim().max(300).optional().default(""),
});

export const experimentResponseSchema = z.object({
  result: z.enum(RESULT_VALUES),
  selectedOptionId: z.string().trim().optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const relationshipSchema = z.object({
  fromConceptId: z.string().trim().min(1),
  toConceptId: z.string().trim().min(1),
  relationType: z.enum(RELATION_TYPES),
  status: z.enum(["hypothesis", "confirmed"]).optional().default("hypothesis"),
  notes: z.string().trim().max(1000).optional().default(""),
});

export const relationshipPatchSchema = z.object({
  status: z.enum(["hypothesis", "confirmed"]),
  notes: z.string().trim().max(1000).optional(),
});

export const activityGenerateSchema = z.object({
  type: z.enum(ACTIVITY_TYPES).optional(),
});

export const activityResponseSchema = z.object({
  selectedOptionId: z.string().trim().optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  selfAssessment: z.enum(["matched", "unsure", "different"]).optional(),
});

export const noteSchema = z.object({
  title: z.string().trim().min(1, "Add a title.").max(140),
  body: z.string().trim().min(1, "Write the note.").max(8000),
  conceptId: z.string().trim().optional().nullable(),
});

export const expressionSchema = z.object({
  title: z.string().trim().min(1, "Name this expression trial.").max(140),
  gloss: z.string().trim().max(500).optional().default(""),
  orderNote: z.string().trim().max(1000).optional().default(""),
  grammarNote: z.string().trim().max(2000).optional().default(""),
  contextExample: z.string().trim().max(1000).optional().default(""),
  counterexample: z.string().trim().max(1000).optional().default(""),
  conceptIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one concept.").max(8),
});

export const expressionPatchSchema = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  gloss: z.string().trim().max(500).optional(),
  orderNote: z.string().trim().max(1000).optional(),
  grammarNote: z.string().trim().max(2000).optional(),
  contextExample: z.string().trim().max(1000).optional(),
  counterexample: z.string().trim().max(1000).optional(),
  status: z.enum(["hypothesis", "testing", "understood", "corrected"]).optional(),
  conceptIds: z.array(z.string().trim().min(1)).min(1).max(8).optional(),
  shown: z.boolean().optional(),
  comprehension: z.enum(["", "understood", "unclear", "clarification"]).optional(),
  comprehensionNote: z.string().trim().max(500).optional(),
});

export const communityActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-task"), templateId: z.string().trim().min(1) }),
  z.object({ action: z.literal("show"), taskId: z.string().trim().min(1), note: z.string().trim().max(500).optional() }),
  z.object({
    action: z.literal("respond"),
    taskId: z.string().trim().min(1),
    kind: z.enum(["interpretation", "drawing"]).optional().default("interpretation"),
    body: z.string().trim().max(4000),
  }),
  z.object({ action: z.literal("lock"), taskId: z.string().trim().min(1) }),
  z.object({ action: z.literal("ambiguity"), taskId: z.string().trim().min(1), note: z.string().trim().min(1).max(1000) }),
  z.object({
    action: z.literal("propose"),
    taskId: z.string().trim().min(1),
    interpretations: z.array(z.string().trim().min(1).max(300)).max(6).optional(),
  }),
  z.object({
    action: z.literal("approve"),
    proposalId: z.string().trim().min(1),
    conceptId: z.string().trim().min(1).optional(),
  }),
  z.object({
    action: z.literal("outcome"),
    taskId: z.string().trim().min(1),
    outcome: z.enum(["understood", "unclear", "another-round"]),
    note: z.string().trim().max(1000).optional(),
  }),
]);

export const deleteSessionSchema = z.object({
  confirmCode: z.string().trim().toUpperCase(),
});

export const demoEnterSchema = z.object({
  role: roleSchema,
});
