import { prisma } from "@/lib/database/prisma";
import { conceptInSession, recordEvent, refreshConceptStatus, requireParticipant } from "@/lib/domain/common";
import { HttpError } from "@/lib/http";
import { buildActivities, clarificationFor } from "@/lib/learning/build";
import { buildExperiment } from "@/lib/verification/experiments";
import { VARIED_EXPERIMENT_TYPES } from "@/lib/constants";
import type { z } from "zod";
import type {
  activityGenerateSchema,
  activityResponseSchema,
  experimentCreateSchema,
  experimentResponseSchema,
  expressionPatchSchema,
  expressionSchema,
  noteSchema,
  relationshipPatchSchema,
  relationshipSchema,
} from "@/lib/validation/schemas";

export async function createExperiment(code: string, token: string | null, input: z.infer<typeof experimentCreateSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  const concept = await conceptInSession(session.id, input.conceptId);
  if (!concept.agreedMeaning) throw new HttpError(400, "Accept a participant interpretation before running a check.");
  const siblings = await prisma.concept.findMany({
    where: { sessionId: session.id, archivedAt: null },
    select: { id: true, agreedMeaning: true, alternativeInterpretations: true },
  });
  const prior = await prisma.verificationExperiment.findMany({
    where: { conceptId: concept.id, sessionId: session.id },
    select: { type: true, stimulusKey: true, contextNote: true },
  });
  const note = input.stimulusNote?.trim() ?? "";
  const varied = (VARIED_EXPERIMENT_TYPES as readonly string[]).includes(input.type);
  if (varied && prior.some((item) => item.type === input.type && item.contextNote.trim().toLowerCase() === note.toLowerCase())) {
    throw new HttpError(409, "This repeats a stimulus already used for that kind of check. Describe what is different about the new example.");
  }
  const round = prior.length + 1;
  const draft = buildExperiment({ type: input.type, concept, siblings, round, stimulusNote: note });
  if (!varied && prior.some((item) => item.stimulusKey === draft.stimulusKey)) {
    throw new HttpError(409, "This check uses the same entries as an earlier one. Add a concept to contrast, or choose a different kind of check.");
  }
  const experiment = await prisma.verificationExperiment.create({
    data: {
      sessionId: session.id,
      conceptId: concept.id,
      type: input.type,
      prompt: draft.prompt,
      optionsJson: JSON.stringify(draft.options),
      stimulusKey: draft.stimulusKey,
      stimulusVariation: draft.stimulusVariation,
      contextNote: note,
      round,
    },
  });
  await recordEvent(session.id, {
    type: "experiment.created",
    message: `${participant.displayName} opened a ${input.type.replaceAll("_", " ")} check for ${concept.conceptCode}.`,
    participantId: participant.id,
    payload: { experimentId: experiment.id, conceptId: concept.id },
  });
  return { experimentId: experiment.id };
}

export async function respondToExperiment(
  code: string,
  token: string | null,
  experimentId: string,
  input: z.infer<typeof experimentResponseSchema>,
) {
  const { session, participant } = await requireParticipant(code, token);
  const experiment = await prisma.verificationExperiment.findFirst({
    where: { id: experimentId, sessionId: session.id },
    include: { responses: true },
  });
  if (!experiment) throw new HttpError(404, "That check is not in this session.");
  if (experiment.responses.some((response) => response.participantId === participant.id)) {
    throw new HttpError(409, "You already recorded a response for this check.");
  }
  await prisma.verificationResponse.create({
    data: {
      sessionId: session.id,
      experimentId: experiment.id,
      participantId: participant.id,
      result: input.result,
      notes: input.notes,
      responseJson: JSON.stringify({ selectedOptionId: input.selectedOptionId }),
    },
  });
  const concept = await conceptInSession(session.id, experiment.conceptId);
  const derived = await refreshConceptStatus(concept.id, {
    disputed: concept.status === "disputed" || input.result === "disagree",
  });
  await recordEvent(session.id, {
    type: "experiment.answered",
    message: `${participant.displayName} recorded “${input.result}” for a check on ${concept.conceptCode}. Status is now ${derived.status}.`,
    participantId: participant.id,
    payload: { experimentId, conceptId: concept.id, result: input.result },
  });
  return { status: derived.status, reason: derived.reason };
}

export async function createRelationship(code: string, token: string | null, input: z.infer<typeof relationshipSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  if (input.fromConceptId === input.toConceptId) throw new HttpError(400, "Choose two different concepts.");
  const from = await conceptInSession(session.id, input.fromConceptId);
  const to = await conceptInSession(session.id, input.toConceptId);
  const relationship = await prisma.conceptRelationship.create({
    data: {
      sessionId: session.id,
      fromConceptId: from.id,
      toConceptId: to.id,
      relationType: input.relationType,
      status: input.status,
      notes: input.notes,
    },
  });
  await recordEvent(session.id, {
    type: "relationship.added",
    message: `${participant.displayName} linked ${from.conceptCode} to ${to.conceptCode} as “${input.relationType}” (${input.status}).`,
    participantId: participant.id,
    payload: { relationshipId: relationship.id },
  });
  return { relationshipId: relationship.id };
}

export async function updateRelationship(code: string, token: string | null, relationshipId: string, input: z.infer<typeof relationshipPatchSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  const relationship = await prisma.conceptRelationship.findFirst({ where: { id: relationshipId, sessionId: session.id } });
  if (!relationship) throw new HttpError(404, "That relationship is not in this session.");
  await prisma.conceptRelationship.update({
    where: { id: relationship.id },
    data: { status: input.status, notes: input.notes ?? relationship.notes },
  });
  await recordEvent(session.id, {
    type: "relationship.updated",
    message: `${participant.displayName} marked a relationship as ${input.status}.`,
    participantId: participant.id,
    payload: { relationshipId },
  });
  return { ok: true };
}

export async function deleteRelationship(code: string, token: string | null, relationshipId: string) {
  const { session, participant } = await requireParticipant(code, token);
  const relationship = await prisma.conceptRelationship.findFirst({ where: { id: relationshipId, sessionId: session.id } });
  if (!relationship) throw new HttpError(404, "That relationship is not in this session.");
  await prisma.conceptRelationship.delete({ where: { id: relationship.id } });
  await recordEvent(session.id, {
    type: "relationship.removed",
    message: `${participant.displayName} removed a relationship.`,
    participantId: participant.id,
    payload: { relationshipId },
  });
  return { ok: true };
}

export async function generateActivities(code: string, token: string | null, input: z.infer<typeof activityGenerateSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  const concepts = await prisma.concept.findMany({ where: { sessionId: session.id, archivedAt: null } });
  const evidence = await prisma.evidence.findMany({ where: { sessionId: session.id, deletedAt: null } });
  const expressions = await prisma.expression.findMany({
    where: { sessionId: session.id },
    include: { concepts: true },
  });
  const drafts = buildActivities({
    concepts,
    evidence,
    expressions: expressions.map((expression) => ({
      id: expression.id,
      title: expression.title,
      conceptIds: expression.concepts.map((link) => link.conceptId),
    })),
    type: input.type,
  });
  if (!drafts.length) {
    throw new HttpError(400, "Practice needs tentative or verified entries, and the chosen activity needs matching evidence. Disputed and unverified hypotheses are left out.");
  }
  const created = [];
  for (const draft of drafts) {
    const activity = await prisma.learningActivity.create({
      data: {
        sessionId: session.id,
        conceptId: draft.conceptId,
        type: draft.type,
        prompt: draft.prompt,
        optionsJson: JSON.stringify(draft.options),
        answerKey: draft.answerKey,
      },
    });
    created.push(activity.id);
  }
  await recordEvent(session.id, {
    type: "activity.generated",
    message: `${participant.displayName} generated ${created.length} practice ${created.length === 1 ? "activity" : "activities"}.`,
    participantId: participant.id,
    payload: { activityIds: created },
  });
  return { activityIds: created };
}

export async function respondToActivity(code: string, token: string | null, activityId: string, input: z.infer<typeof activityResponseSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  const activity = await prisma.learningActivity.findFirst({ where: { id: activityId, sessionId: session.id } });
  if (!activity) throw new HttpError(404, "That activity is not in this session.");
  const concept = activity.conceptId ? await conceptInSession(session.id, activity.conceptId) : null;
  let correct: boolean | null = null;
  if (activity.answerKey) {
    if (!input.selectedOptionId) throw new HttpError(400, "Choose an option.");
    correct = input.selectedOptionId === activity.answerKey;
  } else if (input.selfAssessment) {
    correct = input.selfAssessment === "matched" ? true : input.selfAssessment === "different" ? false : null;
  }
  const clarification = concept
    ? correct === false || input.selfAssessment === "unsure" || input.selfAssessment === "different"
      ? clarificationFor(concept)
      : "Recorded against the current shared entry. You can still revise that entry in discovery."
    : "Recorded. This activity is not a new meaning.";
  const response = await prisma.activityResponse.create({
    data: {
      activityId: activity.id,
      participantId: participant.id,
      correct,
      clarification,
      responseJson: JSON.stringify({
        selectedOptionId: input.selectedOptionId,
        notes: input.notes,
        selfAssessment: input.selfAssessment ?? null,
      }),
    },
  });
  await recordEvent(session.id, {
    type: "activity.answered",
    message: `${participant.displayName} answered a practice activity.`,
    participantId: participant.id,
    payload: { activityId, correct },
  });
  return { responseId: response.id, correct, clarification, practiceMode: "solo" as const };
}

export async function createNote(code: string, token: string | null, input: z.infer<typeof noteSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  if (input.conceptId) await conceptInSession(session.id, input.conceptId);
  const note = await prisma.researchNote.create({
    data: {
      sessionId: session.id,
      conceptId: input.conceptId || null,
      authorParticipantId: participant.id,
      title: input.title,
      body: input.body,
    },
  });
  await recordEvent(session.id, {
    type: "note.added",
    message: `${participant.displayName} added a research note.`,
    participantId: participant.id,
    payload: { noteId: note.id, conceptId: input.conceptId || null },
  });
  return { noteId: note.id };
}

export async function deleteNote(code: string, token: string | null, noteId: string) {
  const { session, participant } = await requireParticipant(code, token);
  const note = await prisma.researchNote.findFirst({ where: { id: noteId, sessionId: session.id } });
  if (!note) throw new HttpError(404, "That note is not in this session.");
  await prisma.researchNote.delete({ where: { id: note.id } });
  await recordEvent(session.id, {
    type: "note.deleted",
    message: `${participant.displayName} deleted a research note.`,
    participantId: participant.id,
    payload: { noteId },
  });
  return { ok: true };
}

export async function createExpression(code: string, token: string | null, input: z.infer<typeof expressionSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  for (const conceptId of input.conceptIds) await conceptInSession(session.id, conceptId);
  const expression = await prisma.expression.create({
    data: {
      sessionId: session.id,
      title: input.title,
      gloss: input.gloss,
      orderNote: input.orderNote,
      grammarNote: input.grammarNote,
      contextExample: input.contextExample,
      counterexample: input.counterexample,
      status: "hypothesis",
      concepts: {
        create: input.conceptIds.map((conceptId, position) => ({ conceptId, position })),
      },
    },
  });
  await recordEvent(session.id, {
    type: "expression.created",
    message: `${participant.displayName} started an expression trial. Any word order is a hypothesis, not a grammar.`,
    participantId: participant.id,
    payload: { expressionId: expression.id },
  });
  return { expressionId: expression.id };
}

export async function updateExpression(code: string, token: string | null, expressionId: string, input: z.infer<typeof expressionPatchSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  const expression = await prisma.expression.findFirst({ where: { id: expressionId, sessionId: session.id } });
  if (!expression) throw new HttpError(404, "That expression is not in this session.");
  if (input.conceptIds) {
    for (const conceptId of input.conceptIds) await conceptInSession(session.id, conceptId);
    await prisma.expressionConcept.deleteMany({ where: { expressionId: expression.id } });
    await prisma.expressionConcept.createMany({
      data: input.conceptIds.map((conceptId, position) => ({ expressionId: expression.id, conceptId, position })),
    });
  }
  await prisma.expression.update({
    where: { id: expression.id },
    data: {
      title: input.title ?? expression.title,
      gloss: input.gloss ?? expression.gloss,
      orderNote: input.orderNote ?? expression.orderNote,
      grammarNote: input.grammarNote ?? expression.grammarNote,
      contextExample: input.contextExample ?? expression.contextExample,
      counterexample: input.counterexample ?? expression.counterexample,
      status: input.status ?? expression.status,
      shownAt: input.shown ? new Date() : expression.shownAt,
      comprehension: input.comprehension ?? expression.comprehension,
      comprehensionNote: input.comprehensionNote ?? expression.comprehensionNote,
    },
  });
  await recordEvent(session.id, {
    type: "expression.updated",
    message: `${participant.displayName} updated an expression trial.`,
    participantId: participant.id,
    payload: { expressionId, status: input.status ?? expression.status },
  });
  return { ok: true };
}
