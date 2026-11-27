import { getAIPublicStatus } from "@/lib/ai/config";
import { comparisonOpen, presentResponse } from "@/lib/community/visibility";
import { prisma } from "@/lib/database/prisma";
import { OPAQUE_SESSION } from "@/lib/access/credentials";
import { canMutateHypotheses } from "@/lib/access/policy";
import { requireParticipant } from "@/lib/domain/common";
import { hideEventPayload, presentReplies, redactPrivateEvent, seesResearchPlan, visibleOpenHypothesisCount } from "@/lib/experiments/privacy";
import { parseReplies, storedRecommendation } from "@/lib/domain/plans";
import { signMediaPath } from "@/lib/media/sign";
import { syncTransport } from "@/lib/sync/transport";
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
  const { session, participant } = await requireParticipant(code, token);
  const full = await prisma.discoverySession.findUnique({ where: { id: session.id }, include });
  if (!full) throw new HttpError(404, OPAQUE_SESSION);
  return serialize(full, participant);
}

export async function syncSession(code: string, token: string | null, since: number) {
  const { session } = await requireParticipant(code, token);
  const fresh = await prisma.discoverySession.findUnique({ where: { id: session.id } });
  if (!fresh) throw new HttpError(404, OPAQUE_SESSION);
  const mediaUrls = await currentMediaUrls(session.id);
  if (since > 0 && fresh.revision === since) {
    const participants = await prisma.participant.findMany({ where: { sessionId: session.id } });
    return { revision: fresh.revision, state: null, presence: participants.map(publicParticipant), mediaUrls, transport: syncTransport() };
  }
  const state = await loadSessionState(code, token);
  return { revision: state.session.revision, state, presence: state.participants, mediaUrls, transport: syncTransport() };
}

async function currentMediaUrls(sessionId: string) {
  const rows = await prisma.evidence.findMany({
    where: { sessionId, deletedAt: null, storagePath: { not: null } },
    select: { id: true },
  });
  const urls: Record<string, string> = {};
  for (const row of rows) {
    const url = signMediaPath(row.id);
    if (url) urls[row.id] = url;
  }
  return urls;
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
  const seesPlan = seesResearchPlan(session.purpose, viewer);
  const seesKey = viewer
    ? canMutateHypotheses({ purpose: session.purpose, role: viewer.role, communityRole: viewer.communityRole })
    : false;
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
      mediaUrl: item.storagePath ? signMediaPath(item.id) : null,
      createdAt: item.createdAt.toISOString(),
    })),
    hypotheses: seesPlan ? session.hypotheses.map((hypothesis) => ({
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
    })) : [],
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
      options: seesPlan ? parseJson<Array<{ id: string; label: string }>>(experiment.optionsJson, []) : [],
      stimulusKey: seesPlan ? experiment.stimulusKey : "",
      stimulusVariation: experiment.stimulusVariation,
      contextNote: seesPlan ? experiment.contextNote : "",
      status: experiment.status,
      round: experiment.round,
      createdAt: experiment.createdAt.toISOString(),
      responses: experiment.responses.filter((response) => {
        if (seesPlan) return true;
        if (response.participantId === viewer?.id) return true;
        const authors = new Set(experiment.responses.map((item) => item.participantId));
        return authors.size >= 2;
      }).map((response) => ({
        id: response.id,
        participantId: response.participantId,
        participantName: response.participant.displayName,
        result: response.result,
        selectedOptionId: seesPlan ? parseJson<{ selectedOptionId?: string }>(response.responseJson, {}).selectedOptionId ?? "" : "",
        notes: response.participantId === viewer?.id || seesPlan ? response.notes : "",
        createdAt: response.createdAt.toISOString(),
      })),
    })),
    activities: session.activities.map((activity) => ({
      id: activity.id,
      conceptId: activity.conceptId,
      type: activity.type,
      prompt: activity.prompt,
      options: parseJson<Array<{ id: string; label: string }>>(activity.optionsJson, []),
      answerKey: seesKey ? activity.answerKey : "",
      practiceMode: "solo" as const,
      source: activity.source,
      createdAt: activity.createdAt.toISOString(),
      responses: activity.responses
        .filter((response) => seesKey || response.participantId === viewer?.id)
        .map((response) => ({
          id: response.id,
          participantId: response.participantId,
          participantName: response.participant.displayName,
          correct: response.participantId === viewer?.id || seesKey ? response.correct : null,
          notes: response.participantId === viewer?.id || seesKey ? parseJson<{ notes?: string }>(response.responseJson, {}).notes ?? "" : "",
          clarification: response.participantId === viewer?.id || seesKey ? response.clarification : "",
          createdAt: response.createdAt.toISOString(),
        })),
    })),
    notes: session.notes.filter((note) => seesPlan || note.authorParticipantId === viewer?.id).map((note) => ({
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
      message: redactPrivateEvent(event.type, event.message, seesPlan),
      payload: event.type === "activity.answered"
        ? (seesKey || event.participantId === viewer?.id ? parseJson(event.payloadJson, {}) : {})
        : hideEventPayload(event.type, seesPlan) ? {} : parseJson(event.payloadJson, {}),
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
    proposals: session.proposals.map((proposal) => {
      const plan = seesPlan ? storedRecommendation(proposal.planJson) : null;
      const replies = presentReplies(parseReplies(proposal.repliesJson), viewer?.id ?? null);
      const visiblePrompt = proposal.status === "approved" || seesPlan ? proposal.prompt : "";
      return {
        id: proposal.id,
        taskId: proposal.taskId,
        distinguishes: seesPlan ? proposal.distinguishes : "",
        missing: seesPlan ? proposal.missing : "",
        rationale: seesPlan ? proposal.rationale : "",
        experimentType: proposal.experimentType,
        prompt: visiblePrompt,
        outcomes: seesPlan ? parseJson<Array<{ outcome: string; supports: string; weakens: string }>>(proposal.outcomesJson, []) : [],
        status: proposal.status,
        source: seesPlan ? proposal.source : "",
        simulated: proposal.simulated,
        disclaimer: seesPlan ? proposal.disclaimer : "",
        createdExperimentId: proposal.createdExperimentId,
        createdAt: proposal.createdAt.toISOString(),
        title: proposal.status === "approved" || seesPlan ? proposal.title : "A check is being prepared.",
        researchQuestion: seesPlan ? proposal.researchQuestion : "",
        procedure: seesPlan ? proposal.procedure : "",
        remainingAmbiguity: seesPlan ? proposal.remainingAmbiguity : "",
        limitations: seesPlan ? proposal.limitations : "",
        usefulness: seesPlan ? proposal.usefulness : "",
        heuristicNote: seesPlan ? proposal.heuristicNote : "",
        heuristicScore: seesPlan ? proposal.heuristicScore : 0,
        quality: seesPlan ? plan?.quality?.checks ?? [] : [],
        qualityWeak: seesPlan ? Boolean(plan?.quality?.weak) : false,
        reviewState: seesPlan && (plan?.reviewState === "draft" || plan?.reviewState === "ready") ? plan.reviewState : "",
        evidenceRefs: seesPlan ? parseJson<string[]>(proposal.evidenceRefsJson, []) : [],
        competingIds: seesPlan ? parseJson<string[]>(proposal.competingIdsJson, []) : [],
        stimuli: seesPlan ? parseJson<string[]>(proposal.stimuliJson, []) : [],
        providerNote: seesPlan ? proposal.providerNote : "",
        recordedOutcome: seesPlan ? proposal.recordedOutcome : "",
        review: seesPlan ? readableReview(proposal.outcomeReviewJson) : null,
        replies,
        planOutcomes: plan?.outcomes ?? [],
      };
    }),
    ai: getAIPublicStatus(),
    counts: {
      established: activeConcepts.filter((concept) => concept.status === "verified").length,
      pending: activeConcepts.filter((concept) => concept.status !== "verified").length,
      verified: activeConcepts.filter((concept) => concept.status === "verified").length,
      disputed: activeConcepts.filter((concept) => concept.status === "disputed").length,
      tentative: activeConcepts.filter((concept) => concept.status === "tentative").length,
      evidence: session.evidence.length,
      openHypotheses: visibleOpenHypothesisCount(session.purpose, viewer, session.hypotheses.filter((hypothesis) => hypothesis.status === "open").length),
    },
  };
}

function readableReview(value: string) {
  const parsed = parseJson<{
    supports?: string;
    weakens?: string;
    remainingAmbiguity?: string;
    stillPossible?: string[];
    verified?: boolean;
    nextStep?: string;
  } | null>(value, null);
  if (!parsed?.supports || !parsed.weakens || !parsed.remainingAmbiguity || !parsed.nextStep) return null;
  return {
    supports: parsed.supports,
    weakens: parsed.weakens,
    remainingAmbiguity: parsed.remainingAmbiguity,
    stillPossible: Array.isArray(parsed.stillPossible) ? parsed.stillPossible : [],
    verified: false,
    nextStep: parsed.nextStep,
  };
}
