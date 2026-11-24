import { getAIPublicStatus } from "@/lib/ai/config";
import { comparisonOpen, presentResponse } from "@/lib/community/visibility";
import { prisma } from "@/lib/database/prisma";
import { getSessionByCode } from "@/lib/domain/common";
import { HttpError } from "@/lib/http";
import { parseJson } from "@/lib/utils";
import type { Participant, Prisma } from "@prisma/client";
import type { SessionState } from "@/lib/types";

const include = {
  participants: true,
  evidence: { where: { deletedAt: null }, orderBy: { createdAt: "desc" as const } },
  concepts: { include: { vocabulary: true }, orderBy: { createdAt: "asc" as const } },
  hypotheses: { orderBy: { createdAt: "desc" as const } },
  relationships: { orderBy: { createdAt: "asc" as const } },
  experiments: { include: { responses: { include: { participant: true } } }, orderBy: { createdAt: "desc" as const } },
  activities: { include: { responses: { include: { participant: true } } }, orderBy: { createdAt: "desc" as const } },
  notes: { include: { author: true }, orderBy: { createdAt: "desc" as const } },
  events: { orderBy: { createdAt: "desc" as const }, take: 80 },
  expressions: { include: { concepts: { orderBy: { position: "asc" as const } } }, orderBy: { createdAt: "desc" as const } },
  tasks: { orderBy: { createdAt: "desc" as const } },
  responses: { orderBy: { createdAt: "asc" as const } },
  proposals: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.DiscoverySessionInclude;

type FullSession = Prisma.DiscoverySessionGetPayload<{ include: typeof include }>;

function connected(lastSeen: Date, leftAt: Date | null) {
  if (leftAt) return false;
  return Date.now() - lastSeen.getTime() < 12_000;
}

export async function loadSessionState(code: string, token: string | null): Promise<SessionState> {
  const session = await getSessionByCode(code);
  let viewer: Participant | null = null;
  if (token) {
    const participant = await prisma.participant.findUnique({ where: { token } });
    if (!participant || participant.sessionId !== session.id) {
      throw new HttpError(403, "This recovery key does not belong to the session.");
    }
    if (!participant.leftAt) {
      viewer = await prisma.participant.update({
        where: { id: participant.id },
        data: { lastSeenAt: new Date() },
      });
    } else {
      viewer = participant;
    }
  }
  const full = await prisma.discoverySession.findUnique({ where: { id: session.id }, include });
  if (!full) throw new HttpError(404, "No session uses that code.");
  return serialize(full, viewer);
}

export async function syncSession(code: string, token: string | null, since: number) {
  const session = await getSessionByCode(code);
  if (token) {
    const participant = await prisma.participant.findUnique({ where: { token } });
    if (participant && participant.sessionId === session.id && !participant.leftAt) {
      await prisma.participant.update({ where: { id: participant.id }, data: { lastSeenAt: new Date() } });
    } else if (participant && participant.sessionId !== session.id) {
      throw new HttpError(403, "This recovery key does not belong to the session.");
    }
  }
  const fresh = await prisma.discoverySession.findUnique({ where: { id: session.id } });
  if (!fresh) throw new HttpError(404, "No session uses that code.");
  if (since > 0 && fresh.revision === since) {
    const participants = await prisma.participant.findMany({ where: { sessionId: session.id } });
    return { revision: fresh.revision, state: null, presence: participants.map(publicParticipant) };
  }
  const state = await loadSessionState(code, token);
  return { revision: state.session.revision, state, presence: state.participants };
}

function publicParticipant(participant: Participant) {
  return {
    id: participant.id,
    displayName: participant.displayName,
    role: participant.role,
    communityRole: participant.communityRole,
    leftAt: participant.leftAt?.toISOString() ?? null,
    lastSeenAt: participant.lastSeenAt.toISOString(),
    connected: connected(participant.lastSeenAt, participant.leftAt),
  };
}

function serialize(session: FullSession, viewer: Participant | null): SessionState {
  const names = new Map(session.participants.map((participant) => [participant.id, participant.displayName]));
  const activeConcepts = session.concepts.filter((concept) => concept.status !== "archived");
  return {
    session: {
      id: session.id,
      code: session.code,
      name: session.name,
      description: session.description,
      objective: session.objective,
      purpose: session.purpose,
      status: session.status,
      archivedAt: session.archivedAt?.toISOString() ?? null,
      isDemo: session.isDemo,
      isIllustrative: session.isIllustrative,
      revision: session.revision,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
    viewer: viewer
      ? { id: viewer.id, role: viewer.role, communityRole: viewer.communityRole, displayName: viewer.displayName }
      : null,
    participants: session.participants
      .sort((a, b) => a.role.localeCompare(b.role))
      .map(publicParticipant),
    concepts: session.concepts.map((concept) => ({
      id: concept.id,
      conceptCode: concept.conceptCode,
      agreedMeaning: concept.agreedMeaning,
      category: concept.category,
      status: concept.status,
      statusReason: concept.statusReason,
      contextualNotes: concept.contextualNotes,
      exampleSituations: concept.exampleSituations,
      alternativeInterpretations: concept.alternativeInterpretations,
      aiConfidence: concept.aiConfidence,
      createdAt: concept.createdAt.toISOString(),
      updatedAt: concept.updatedAt.toISOString(),
      archivedAt: concept.archivedAt?.toISOString() ?? null,
      summary: concept.vocabulary?.summary ?? "",
    })),
    evidence: session.evidence.map((item) => ({
      id: item.id,
      participantId: item.participantId,
      participantName: names.get(item.participantId) ?? "Participant",
      conceptId: item.conceptId,
      type: item.type,
      mimeType: item.mimeType,
      fileName: item.fileName,
      byteSize: item.byteSize,
      description: item.description,
      actionCategory: item.actionCategory,
      notes: item.notes,
      stance: item.stance,
      consentToAnalyze: item.consentToAnalyze,
      durationMs: item.durationMs,
      qualityNote: item.qualityNote,
      annotation: item.annotation,
      parentEvidenceId: item.parentEvidenceId,
      gestureDirection: item.gestureDirection,
      gestureRepetition: item.gestureRepetition,
      gestureBody: item.gestureBody,
      mediaUrl: item.storagePath ? `/api/media/${item.id}?code=${session.code}` : null,
      createdAt: item.createdAt.toISOString(),
    })),
    hypotheses: session.hypotheses.map((hypothesis) => ({
      id: hypothesis.id,
      conceptId: hypothesis.conceptId,
      evidenceId: hypothesis.evidenceId,
      proposedMeaning: hypothesis.proposedMeaning,
      explanation: hypothesis.explanation,
      supportingEvidence: hypothesis.supportingEvidence,
      alternatives: hypothesis.alternatives,
      missingInformation: hypothesis.missingInformation,
      culturalAmbiguity: hypothesis.culturalAmbiguity,
      cannotDetermine: hypothesis.cannotDetermine,
      confidence: hypothesis.confidence,
      suggestedExperiment: hypothesis.suggestedExperiment,
      source: hypothesis.source,
      status: hypothesis.status,
      simulated: hypothesis.simulated,
      providerNote: hypothesis.providerNote,
      createdByParticipantId: hypothesis.createdByParticipantId,
      createdAt: hypothesis.createdAt.toISOString(),
    })),
    relationships: session.relationships.map((relationship) => ({
      id: relationship.id,
      fromConceptId: relationship.fromConceptId,
      toConceptId: relationship.toConceptId,
      relationType: relationship.relationType,
      status: relationship.status,
      notes: relationship.notes,
      createdAt: relationship.createdAt.toISOString(),
    })),
    experiments: session.experiments.map((experiment) => ({
      id: experiment.id,
      conceptId: experiment.conceptId,
      type: experiment.type,
      prompt: experiment.prompt,
      options: parseJson<Array<{ id: string; label: string }>>(experiment.optionsJson, []),
      stimulusKey: experiment.stimulusKey,
      stimulusVariation: experiment.stimulusVariation,
      contextNote: experiment.contextNote,
      status: experiment.status,
      round: experiment.round,
      createdAt: experiment.createdAt.toISOString(),
      responses: experiment.responses.map((response) => ({
        id: response.id,
        participantId: response.participantId,
        participantName: response.participant.displayName,
        result: response.result,
        selectedOptionId: parseJson<{ selectedOptionId?: string }>(response.responseJson, {}).selectedOptionId ?? "",
        notes: response.notes,
        createdAt: response.createdAt.toISOString(),
      })),
    })),
    activities: session.activities.map((activity) => ({
      id: activity.id,
      conceptId: activity.conceptId,
      type: activity.type,
      prompt: activity.prompt,
      options: parseJson<Array<{ id: string; label: string }>>(activity.optionsJson, []),
      answerKey: activity.answerKey,
      source: activity.source,
      createdAt: activity.createdAt.toISOString(),
      responses: activity.responses.map((response) => ({
        id: response.id,
        participantId: response.participantId,
        participantName: response.participant.displayName,
        correct: response.correct,
        notes: parseJson<{ notes?: string }>(response.responseJson, {}).notes ?? "",
        clarification: response.clarification,
        createdAt: response.createdAt.toISOString(),
      })),
    })),
    notes: session.notes.map((note) => ({
      id: note.id,
      conceptId: note.conceptId,
      authorParticipantId: note.authorParticipantId,
      authorName: note.author?.displayName ?? null,
      title: note.title,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    events: session.events.map((event) => ({
      id: event.id,
      participantId: event.participantId,
      type: event.type,
      message: event.message,
      payload: parseJson(event.payloadJson, {}),
      createdAt: event.createdAt.toISOString(),
    })),
    expressions: session.expressions.map((expression) => ({
      id: expression.id,
      title: expression.title,
      gloss: expression.gloss,
      orderNote: expression.orderNote,
      grammarNote: expression.grammarNote,
      contextExample: expression.contextExample,
      counterexample: expression.counterexample,
      status: expression.status,
      shownAt: expression.shownAt?.toISOString() ?? null,
      comprehension: expression.comprehension,
      comprehensionNote: expression.comprehensionNote,
      createdAt: expression.createdAt.toISOString(),
      updatedAt: expression.updatedAt.toISOString(),
      conceptIds: expression.concepts.map((link) => link.conceptId),
    })),
    tasks: session.tasks.map((task) => ({
      id: task.id,
      templateId: task.templateId,
      title: task.title,
      category: task.category,
      step: task.step,
      shownNote: task.shownNote,
      ambiguityNote: task.ambiguityNote,
      outcome: task.outcome,
      outcomeNote: task.outcomeNote,
      createdAt: task.createdAt.toISOString(),
    })),
    responses: session.responses.map((response) => {
      const task = session.tasks.find((item) => item.id === response.taskId);
      const siblings = session.responses.filter((item) => item.taskId === response.taskId);
      const open = comparisonOpen(
        siblings.map((item) => ({ authorParticipantId: item.authorParticipantId, lockedAt: item.lockedAt?.toISOString() ?? null })),
        task?.step ?? "show",
      );
      return presentResponse({
        id: response.id,
        taskId: response.taskId,
        authorParticipantId: response.authorParticipantId,
        kind: response.kind,
        body: response.body,
        lockedAt: response.lockedAt?.toISOString() ?? null,
        mediaUrl: null,
      }, viewer?.id ?? null, open);
    }),
    proposals: session.proposals.map((proposal) => ({
      id: proposal.id,
      taskId: proposal.taskId,
      distinguishes: proposal.distinguishes,
      missing: proposal.missing,
      rationale: proposal.rationale,
      experimentType: proposal.experimentType,
      prompt: proposal.prompt,
      outcomes: parseJson<Array<{ outcome: string; supports: string; weakens: string }>>(proposal.outcomesJson, []),
      status: proposal.status,
      source: proposal.source,
      simulated: proposal.simulated,
      disclaimer: proposal.disclaimer,
      createdExperimentId: proposal.createdExperimentId,
      createdAt: proposal.createdAt.toISOString(),
    })),
    ai: getAIPublicStatus(),
    counts: {
      established: activeConcepts.filter((concept) => concept.status === "verified").length,
      pending: activeConcepts.filter((concept) => concept.status !== "verified").length,
      verified: activeConcepts.filter((concept) => concept.status === "verified").length,
      disputed: activeConcepts.filter((concept) => concept.status === "disputed").length,
      tentative: activeConcepts.filter((concept) => concept.status === "tentative").length,
      evidence: session.evidence.length,
      openHypotheses: session.hypotheses.filter((hypothesis) => hypothesis.status === "open").length,
    },
  };
}
