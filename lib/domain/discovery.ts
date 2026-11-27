import path from "path";
import { getAIPublicStatus } from "@/lib/ai/config";
import { getProvider } from "@/lib/ai";
import { prisma } from "@/lib/database/prisma";
import { canDeleteEvidence, canMutateHypotheses } from "@/lib/access/policy";
import { conceptInSession, recordEvent, refreshConceptStatus, requireParticipant, summaryFor } from "@/lib/domain/common";
import { seesResearchPlan } from "@/lib/experiments/privacy";
import { HttpError } from "@/lib/http";
import { limitBytes } from "@/lib/constants";
import { nextConceptCode } from "@/lib/session/codes";
import { extensionFor, inferMime, sanitizeName } from "@/lib/storage/files";
import { readUpload, removeUpload, writeUpload } from "@/lib/storage";
import type { z } from "zod";
import type {
  conceptCreateSchema,
  conceptPatchSchema,
  evidenceFieldsSchema,
  hypothesisResponseSchema,
  participantHypothesisSchema,
} from "@/lib/validation/schemas";

const FILE_TYPES = new Set(["image", "drawing", "audio", "video"]);

const ALLOWED: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  drawing: ["image/png", "image/jpeg", "image/webp"],
  audio: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-wav", "video/webm"],
  video: ["video/webm", "video/mp4", "video/quicktime"],
  gesture: ["video/webm", "video/mp4", "video/quicktime"],
};

export async function addEvidence(input: {
  code: string;
  token: string | null;
  fields: z.infer<typeof evidenceFieldsSchema>;
  file?: { bytes: Buffer; mimeType: string; fileName: string } | null;
}) {
  const { session, participant } = await requireParticipant(input.code, input.token);
  const fields = input.fields;
  if (fields.conceptId) await conceptInSession(session.id, fields.conceptId);
  if (fields.parentEvidenceId) {
    const parent = await prisma.evidence.findFirst({ where: { id: fields.parentEvidenceId, sessionId: session.id, deletedAt: null } });
    if (!parent) throw new HttpError(400, "The frame must belong to evidence in this session.");
  }
  const file = input.file ?? null;
  if (FILE_TYPES.has(fields.type) && !file) {
    throw new HttpError(400, "Attach a file for this evidence type, or use a note or gesture description.");
  }
  if (file) {
    const mime = inferMime(file.fileName, file.mimeType);
    const allowed = ALLOWED[fields.type];
    if (!allowed || !allowed.includes(mime)) {
      throw new HttpError(400, "This file type is not allowed for that evidence. SVG uploads are rejected. Use a PNG drawing or a common photo, audio, or video type.");
    }
    const limit = fields.type === "audio" ? limitBytes("audio") : fields.type === "video" || fields.type === "gesture" ? limitBytes("video") : limitBytes("image");
    if (file.bytes.length > limit) throw new HttpError(400, "The file is larger than the configured limit.");
    if (!file.bytes.length) throw new HttpError(400, "The file is empty.");
  }
  if ((fields.type === "gesture" || fields.type === "note") && !fields.description.trim() && !file) {
    throw new HttpError(400, "Describe the gesture or note before submitting it.");
  }

  const evidence = await prisma.evidence.create({
    data: {
      sessionId: session.id,
      participantId: participant.id,
      conceptId: fields.conceptId || null,
      type: fields.type,
      description: fields.description,
      notes: fields.notes,
      actionCategory: fields.actionCategory || null,
      stance: fields.stance,
      consentToAnalyze: fields.consentToAnalyze,
      durationMs: fields.durationMs ?? null,
      qualityNote: fields.qualityNote,
      annotation: fields.annotation,
      parentEvidenceId: fields.parentEvidenceId || null,
      gestureDirection: fields.gestureDirection,
      gestureRepetition: fields.gestureRepetition,
      gestureBody: fields.gestureBody,
    },
  });

  if (file) {
    const mime = inferMime(file.fileName, file.mimeType);
    const ext = extensionFor(mime);
    if (!ext) {
      await prisma.evidence.delete({ where: { id: evidence.id } });
      throw new HttpError(400, "This file type is not allowed.");
    }
    const relative = path.posix.join(session.id, `${evidence.id}.${ext}`);
    try {
      await writeUpload(relative, file.bytes, mime);
      await prisma.evidence.update({
        where: { id: evidence.id },
        data: {
          storagePath: relative,
          mimeType: mime,
          fileName: sanitizeName(file.fileName),
          byteSize: file.bytes.length,
        },
      });
    } catch (error) {
      await removeUpload(relative);
      await prisma.evidence.delete({ where: { id: evidence.id } }).catch(() => undefined);
      throw error;
    }
  }

  if (fields.conceptId && fields.stance === "contradictory") {
    await prisma.concept.update({
      where: { id: fields.conceptId },
      data: { reopenedAt: new Date() },
    });
    await refreshConceptStatus(fields.conceptId, { reopened: true, disputed: false });
  }
  await recordEvent(session.id, {
    type: fields.stance === "contradictory" ? "evidence.contradiction" : "evidence.added",
    message: fields.stance === "contradictory"
      ? `${participant.displayName} added contradictory ${fields.type} evidence. The concept was reopened.`
      : `${participant.displayName} added ${fields.type} evidence.`,
    participantId: participant.id,
    payload: { evidenceId: evidence.id, conceptId: fields.conceptId || null, stance: fields.stance, consentToAnalyze: fields.consentToAnalyze },
  });
  return { evidenceId: evidence.id };
}

export async function deleteEvidence(code: string, token: string | null, evidenceId: string) {
  const { session, participant } = await requireParticipant(code, token);
  const evidence = await prisma.evidence.findFirst({ where: { id: evidenceId, sessionId: session.id } });
  if (!evidence || (evidence.deletedAt && !evidence.storagePath)) throw new HttpError(404, "That evidence is not in this session.");
  if (!canDeleteEvidence(
    { purpose: session.purpose, role: participant.role, communityRole: participant.communityRole },
    evidence.participantId,
    participant.id,
  )) {
    throw new HttpError(403, "You can delete your own evidence. The other person's record stays.");
  }
  await prisma.evidence.update({
    where: { id: evidence.id },
    data: { deletedAt: evidence.deletedAt ?? new Date() },
  });
  if (evidence.storagePath) {
    await removeUpload(evidence.storagePath);
    await prisma.evidence.update({
      where: { id: evidence.id },
      data: { storagePath: null },
    });
  }
  await recordEvent(session.id, {
    type: "evidence.deleted",
    message: `${participant.displayName} deleted ${evidence.type} evidence.`,
    participantId: participant.id,
    payload: { evidenceId: evidence.id },
  });
  return { ok: true };
}

export async function analyzeEvidence(code: string, token: string | null, evidenceId: string) {
  const { session, participant } = await requireParticipant(code, token);
  if (!seesResearchPlan(session.purpose, participant)) {
    throw new HttpError(403, "In a community session, the facilitator requests readings. That does not decide the meaning.");
  }
  const evidence = await prisma.evidence.findFirst({ where: { id: evidenceId, sessionId: session.id, deletedAt: null } });
  if (!evidence) throw new HttpError(404, "That evidence is not in this session.");
  const concepts = await prisma.concept.findMany({ where: { sessionId: session.id, archivedAt: null } });
  const sendMedia = evidence.consentToAnalyze && Boolean(evidence.storagePath);
  let mediaBytes: Buffer | null = null;
  if (sendMedia && evidence.storagePath) mediaBytes = await readUpload(evidence.storagePath);
  const provider = getProvider();
  let analysis;
  try {
    analysis = await provider.analyze({
      evidenceType: evidence.type,
      description: evidence.description,
      notes: evidence.notes,
      actionCategory: evidence.actionCategory,
      fileName: evidence.fileName,
      mimeType: evidence.mimeType,
      mediaBytes,
      consentToAnalyze: evidence.consentToAnalyze,
      durationMs: evidence.durationMs,
      qualityNote: evidence.qualityNote,
      stance: evidence.stance,
      parentEvidenceId: evidence.parentEvidenceId,
      gestureDirection: evidence.gestureDirection,
      gestureRepetition: evidence.gestureRepetition,
      gestureBody: evidence.gestureBody,
      knownConcepts: concepts.map((concept) => ({ meaning: concept.agreedMeaning, status: concept.status })),
    });
  } catch (error) {
    await recordEvent(session.id, {
      type: "analysis.failed",
      message: "Hypothesis generation failed. No meaning was verified.",
      participantId: participant.id,
      payload: { evidenceId, message: error instanceof Error ? error.message : "Unknown error" },
    });
    throw error;
  }

  const created = [];
  for (const hypothesis of analysis.hypotheses) {
    const row = await prisma.conceptHypothesis.create({
      data: {
        sessionId: session.id,
        conceptId: evidence.conceptId,
        evidenceId: evidence.id,
        proposedMeaning: hypothesis.proposedMeaning,
        explanation: hypothesis.explanation,
        supportingEvidence: hypothesis.supportingEvidence,
        alternatives: hypothesis.alternatives,
        missingInformation: hypothesis.missingInformation,
        culturalAmbiguity: hypothesis.culturalAmbiguity,
        cannotDetermine: analysis.cannotDetermine.join(" "),
        confidence: hypothesis.confidence,
        suggestedExperiment: hypothesis.suggestedExperiment,
        source: "ai",
        status: "open",
        simulated: analysis.simulated,
        providerNote: analysis.providerNote,
      },
    });
    created.push(row);
  }
  await recordEvent(session.id, {
    type: "analysis.completed",
    message: analysis.simulated
      ? "Demo mode added simulated hypotheses. They are not verified meanings."
      : "The model added hypotheses. They are not verified meanings.",
    participantId: participant.id,
    payload: {
      evidenceId,
      simulated: analysis.simulated,
      providerNote: analysis.providerNote,
      observations: analysis.observations,
      inferences: analysis.inferences,
      cannotDetermine: analysis.cannotDetermine,
      ambiguities: analysis.ambiguities,
      followUps: analysis.followUps,
      hypothesisIds: created.map((row) => row.id),
    },
  });
  return {
    simulated: analysis.simulated,
    providerNote: analysis.providerNote,
    observations: analysis.observations,
    inferences: analysis.inferences,
    cannotDetermine: analysis.cannotDetermine,
    ambiguities: analysis.ambiguities,
    followUps: analysis.followUps,
    ai: getAIPublicStatus(),
    hypothesisIds: created.map((row) => row.id),
  };
}

export async function addParticipantHypothesis(code: string, token: string | null, input: z.infer<typeof participantHypothesisSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  if (input.conceptId) await conceptInSession(session.id, input.conceptId);
  if (input.evidenceId) {
    const evidence = await prisma.evidence.findFirst({ where: { id: input.evidenceId, sessionId: session.id, deletedAt: null } });
    if (!evidence) throw new HttpError(404, "That evidence is not in this session.");
  }
  const hypothesis = await prisma.conceptHypothesis.create({
    data: {
      sessionId: session.id,
      conceptId: input.conceptId || null,
      evidenceId: input.evidenceId || null,
      proposedMeaning: input.proposedMeaning,
      explanation: input.explanation,
      supportingEvidence: "Proposed by a participant from their own observation.",
      alternatives: input.alternatives,
      confidence: 0,
      suggestedExperiment: input.suggestedExperiment || "Ask the other participant to demonstrate this meaning independently.",
      source: "participant",
      status: "open",
      simulated: false,
      providerNote: "Participant interpretation. Not an AI estimate.",
      createdByParticipantId: participant.id,
    },
  });
  await recordEvent(session.id, {
    type: "hypothesis.proposed",
    message: `${participant.displayName} proposed “${input.proposedMeaning}”.`,
    participantId: participant.id,
    payload: { hypothesisId: hypothesis.id },
  });
  return { hypothesisId: hypothesis.id };
}

function assertHypothesisEditor(session: { purpose: string }, participant: { role: string; communityRole: string }) {
  if (!canMutateHypotheses({ purpose: session.purpose, role: participant.role, communityRole: participant.communityRole })) {
    throw new HttpError(403, "Only the facilitator can change a hypothesis.");
  }
}

export async function respondToHypothesis(code: string, token: string | null, hypothesisId: string, input: z.infer<typeof hypothesisResponseSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  assertHypothesisEditor(session, participant);
  const hypothesis = await prisma.conceptHypothesis.findFirst({ where: { id: hypothesisId, sessionId: session.id } });
  if (!hypothesis) throw new HttpError(404, "That hypothesis is not available.");

  if (input.action === "reject") {
    await prisma.conceptHypothesis.update({ where: { id: hypothesis.id }, data: { status: "rejected" } });
    await recordEvent(session.id, {
      type: "hypothesis.rejected",
      message: `${participant.displayName} rejected “${hypothesis.proposedMeaning}”.`,
      participantId: participant.id,
      payload: { hypothesisId, note: input.note },
    });
    return { status: "rejected" };
  }

  if (input.action === "challenge") {
    await prisma.conceptHypothesis.update({ where: { id: hypothesis.id }, data: { status: "challenged" } });
    const conceptId = input.conceptId || hypothesis.conceptId;
    if (conceptId) {
      await conceptInSession(session.id, conceptId);
      await refreshConceptStatus(conceptId, { disputed: true });
    }
    await recordEvent(session.id, {
      type: "hypothesis.challenged",
      message: `${participant.displayName} challenged “${hypothesis.proposedMeaning}”.`,
      participantId: participant.id,
      payload: { hypothesisId, note: input.note },
    });
    return { status: "challenged" };
  }

  const meaning = input.meaning?.trim() || hypothesis.proposedMeaning;
  const category = input.category || "other";
  let conceptId = input.conceptId || hypothesis.conceptId;
  if (conceptId) {
    const concept = await conceptInSession(session.id, conceptId);
    const meaningChanged = Boolean(concept.agreedMeaning) && concept.agreedMeaning !== meaning;
    await prisma.concept.update({
      where: { id: concept.id },
      data: {
        agreedMeaning: meaning,
        category,
        aiConfidence: hypothesis.source === "ai" ? hypothesis.confidence : concept.aiConfidence,
        alternativeInterpretations: mergeLines(concept.alternativeInterpretations, hypothesis.alternatives),
        ...(meaningChanged ? { reopenedAt: new Date() } : {}),
      },
    });
  } else {
    const existing = await prisma.concept.findMany({ where: { sessionId: session.id }, select: { conceptCode: true } });
    const created = await prisma.concept.create({
      data: {
        sessionId: session.id,
        conceptCode: nextConceptCode(existing.map((concept) => concept.conceptCode)),
        agreedMeaning: meaning,
        category,
        status: "tentative",
        statusReason: "A participant accepted an interpretation. It is not verified.",
        alternativeInterpretations: hypothesis.alternatives,
        aiConfidence: hypothesis.source === "ai" ? hypothesis.confidence : null,
        vocabulary: { create: { sessionId: session.id, summary: summaryFor(meaning, "tentative") } },
      },
    });
    conceptId = created.id;
  }

  await prisma.conceptHypothesis.update({
    where: { id: hypothesis.id },
    data: { status: "accepted", conceptId },
  });
  if (hypothesis.evidenceId) {
    await prisma.evidence.updateMany({
      where: { id: hypothesis.evidenceId, sessionId: session.id, conceptId: null },
      data: { conceptId },
    });
  }
  const derived = await refreshConceptStatus(conceptId, { disputed: false });
  await recordEvent(session.id, {
    type: "hypothesis.accepted",
    message: `${participant.displayName} accepted “${meaning}” as a participant interpretation. Status: ${derived.status}.`,
    participantId: participant.id,
    payload: { hypothesisId, conceptId, note: input.note },
  });
  return { status: derived.status, conceptId };
}

export async function createConcept(code: string, token: string | null, input: z.infer<typeof conceptCreateSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  assertHypothesisEditor(session, participant);
  const existing = await prisma.concept.findMany({ where: { sessionId: session.id }, select: { conceptCode: true } });
  const concept = await prisma.concept.create({
    data: {
      sessionId: session.id,
      conceptCode: nextConceptCode(existing.map((item) => item.conceptCode)),
      agreedMeaning: input.agreedMeaning,
      category: input.category,
      status: "tentative",
      statusReason: "A participant proposed this directly. No verification check has been recorded.",
      contextualNotes: input.contextualNotes,
      exampleSituations: input.exampleSituations,
      alternativeInterpretations: input.alternativeInterpretations,
      vocabulary: { create: { sessionId: session.id, summary: summaryFor(input.agreedMeaning, "tentative") } },
      hypotheses: {
        create: {
          sessionId: session.id,
          proposedMeaning: input.agreedMeaning,
          explanation: input.contextualNotes || "Proposed directly by a participant.",
          supportingEvidence: "Participant proposal.",
          alternatives: input.alternativeInterpretations,
          confidence: 0,
          suggestedExperiment: "Run two different checks before treating this as verified.",
          source: "participant",
          status: "accepted",
          providerNote: "Participant interpretation. Not an AI estimate.",
          createdByParticipantId: participant.id,
        },
      },
    },
  });
  await refreshConceptStatus(concept.id, { disputed: false });
  await recordEvent(session.id, {
    type: "concept.created",
    message: `${participant.displayName} added “${input.agreedMeaning}” as a tentative entry.`,
    participantId: participant.id,
    payload: { conceptId: concept.id },
  });
  return { conceptId: concept.id };
}

export async function updateConcept(code: string, token: string | null, conceptId: string, input: z.infer<typeof conceptPatchSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  const concept = await conceptInSession(session.id, conceptId);
  if (input.action === "archive") {
    await prisma.concept.update({
      where: { id: concept.id },
      data: {
        archivedAt: new Date(),
        status: "archived",
        statusReason: "A participant archived this entry. It stays in the history and is left out of practice.",
      },
    });
    await recordEvent(session.id, {
      type: "concept.archived",
      message: `${participant.displayName} archived ${concept.conceptCode}.`,
      participantId: participant.id,
      payload: { conceptId },
    });
    return { status: "archived" };
  }
  if (input.action === "dispute") {
    await refreshConceptStatus(concept.id, { disputed: true });
    await recordEvent(session.id, {
      type: "concept.disputed",
      message: `${participant.displayName} marked ${concept.conceptCode} as disputed.`,
      participantId: participant.id,
      payload: { conceptId },
    });
    return { status: "disputed" };
  }
  if (input.action === "restore") {
    await prisma.concept.update({
      where: { id: concept.id },
      data: { archivedAt: null, reopenedAt: new Date(), status: "awaiting" },
    });
    const derived = await refreshConceptStatus(concept.id, { disputed: false, archived: false });
    await recordEvent(session.id, {
      type: "concept.restored",
      message: `${participant.displayName} reopened ${concept.conceptCode}.`,
      participantId: participant.id,
      payload: { conceptId },
    });
    return { status: derived.status };
  }

  await prisma.concept.update({
    where: { id: concept.id },
    data: {
      agreedMeaning: input.agreedMeaning ?? concept.agreedMeaning,
      category: input.category ?? concept.category,
      contextualNotes: input.contextualNotes ?? concept.contextualNotes,
      exampleSituations: input.exampleSituations ?? concept.exampleSituations,
      alternativeInterpretations: input.alternativeInterpretations ?? concept.alternativeInterpretations,
    },
  });
  const derived = await refreshConceptStatus(concept.id);
  await recordEvent(session.id, {
    type: "concept.updated",
    message: `${participant.displayName} edited ${concept.conceptCode}.`,
    participantId: participant.id,
    payload: { conceptId },
  });
  return { status: derived.status };
}

function mergeLines(current: string, extra: string) {
  const parts = new Set(
    `${current}\n${extra}`
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
  return [...parts].join("\n");
}
