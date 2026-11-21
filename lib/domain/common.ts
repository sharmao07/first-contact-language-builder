import { prisma } from "@/lib/database/prisma";
import { HttpError } from "@/lib/http";
import { assertSameSession } from "@/lib/session/codes";
import type { CheckRecord, TestResult } from "@/lib/verification/status";
import { deriveVerificationStatus } from "@/lib/verification/status";

export async function getSessionByCode(code: string) {
  const session = await prisma.discoverySession.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!session) throw new HttpError(404, "No session uses that code.");
  return session;
}

export async function requireParticipant(code: string, token: string | null) {
  if (!token) throw new HttpError(401, "Join the session before changing it.");
  const session = await getSessionByCode(code);
  const participant = await prisma.participant.findUnique({ where: { token } });
  if (!participant || participant.sessionId !== session.id) {
    throw new HttpError(403, "This recovery key does not belong to the session.");
  }
  assertSameSession(participant.sessionId, session.id);
  if (participant.leftAt) throw new HttpError(403, "You left this session. Rejoin before making changes.");
  return { session, participant };
}

export async function recordEvent(
  sessionId: string,
  input: { type: string; message: string; participantId?: string | null; payload?: unknown; createdAt?: Date },
) {
  await prisma.$transaction([
    prisma.sessionEvent.create({
      data: {
        sessionId,
        type: input.type,
        message: input.message,
        participantId: input.participantId ?? null,
        payloadJson: JSON.stringify(input.payload ?? {}),
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
    }),
    prisma.discoverySession.update({
      where: { id: sessionId },
      data: { revision: { increment: 1 } },
    }),
  ]);
}

export async function refreshConceptStatus(
  conceptId: string,
  overrides?: { disputed?: boolean; archived?: boolean; reopened?: boolean },
) {
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    include: {
      hypotheses: true,
      experiments: { include: { responses: true } },
    },
  });
  if (!concept) throw new HttpError(404, "That concept is not in the session.");

  const disputed = overrides?.disputed ?? concept.status === "disputed";
  const archived = overrides?.archived ?? Boolean(concept.archivedAt);
  const reopened = overrides?.reopened ?? Boolean(concept.reopenedAt);
  const checks: CheckRecord[] = concept.experiments.flatMap((experiment) =>
    experiment.responses
      .filter((response) => !concept.reopenedAt || response.createdAt > concept.reopenedAt)
      .map((response) => ({
        result: response.result as TestResult,
        experimentType: experiment.type,
        stimulusKey: experiment.stimulusKey || `legacy:${experiment.id}`,
        decisive: true,
      })),
  );
  const participantAccepted =
    concept.hypotheses.some((hypothesis) => hypothesis.status === "accepted") ||
    Boolean(concept.agreedMeaning && !["hypothesis", ""].includes(concept.status));
  const derived = deriveVerificationStatus({ archived, disputed, participantAccepted, reopened, checks });
  const reason = concept.reopenedAt && !disputed && !archived
    ? `${derived.reason} Reopened ${concept.reopenedAt.toISOString()}. Earlier checks remain in the history and do not count toward this round.`
    : derived.reason;

  await prisma.concept.update({
    where: { id: conceptId },
    data: {
      status: derived.status,
      statusReason: reason,
      archivedAt: derived.status === "archived" ? concept.archivedAt ?? new Date() : null,
    },
  });
  await prisma.vocabularyEntry.upsert({
    where: { conceptId },
    update: { summary: summaryFor(concept.agreedMeaning, derived.status) },
    create: {
      sessionId: concept.sessionId,
      conceptId,
      summary: summaryFor(concept.agreedMeaning, derived.status),
    },
  });
  return derived;
}

export function summaryFor(meaning: string, status: string) {
  return meaning ? `${meaning} (${status})` : `Unnamed concept (${status})`;
}

export async function conceptInSession(sessionId: string, conceptId: string) {
  const concept = await prisma.concept.findFirst({ where: { id: conceptId, sessionId } });
  if (!concept) throw new HttpError(404, "That concept is not in this session.");
  assertSameSession(concept.sessionId, sessionId);
  return concept;
}
