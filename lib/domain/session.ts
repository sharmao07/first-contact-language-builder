import { issueCredential, OPAQUE_SESSION, recoveryTtlMs, renewCredential, resolvePresented } from "@/lib/access/credentials";
import { prisma } from "@/lib/database/prisma";
import { recordEvent, requireParticipant } from "@/lib/domain/common";
import { HttpError } from "@/lib/http";
import { createToken, generateSessionCode, isSessionCode } from "@/lib/session/codes";
import { removeUploadDir } from "@/lib/storage";
import type { createSessionSchema, joinSessionSchema, rejoinSessionSchema, sessionPatchSchema } from "@/lib/validation/schemas";
import type { z } from "zod";

export async function createSession(input: z.infer<typeof createSessionSchema>) {
  let code = generateSessionCode();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const existing = await prisma.discoverySession.findUnique({ where: { code } });
    if (!existing) break;
    code = generateSessionCode();
  }
  const community = input.purpose === "community";
  const communityRole = community ? (input.communityRole ?? "facilitator") : "";
  const seat = community ? (communityRole === "participant" ? "B" : "A") : input.role;
  const session = await prisma.discoverySession.create({
    data: {
      code,
      name: input.name,
      description: input.description ?? "",
      objective: input.objective ?? "",
      purpose: input.purpose,
      participants: {
        create: {
          displayName: input.displayName,
          role: seat,
          communityRole,
          token: `pending:${createToken()}`,
        },
      },
    },
    include: { participants: true },
  });
  const participant = session.participants[0];
  const issued = await issueCredential(participant.id, "recovery", recoveryTtlMs());
  await recordEvent(session.id, {
    type: "session.created",
    message: community
      ? `${participant.displayName} opened a community session as ${communityRole}. That role guides the steps. It does not decide meaning.`
      : `${participant.displayName} opened the session as participant ${participant.role}.`,
    participantId: participant.id,
  });
  return {
    code: session.code,
    sessionId: session.id,
    token: issued.token,
    expiresAt: issued.expiresAt.toISOString(),
    participantId: participant.id,
    role: participant.role,
    communityRole: participant.communityRole,
    displayName: participant.displayName,
    purpose: session.purpose,
  };
}

export async function joinSession(input: z.infer<typeof joinSessionSchema>) {
  if (!isSessionCode(input.code)) throw new HttpError(400, "Session codes look like TREE-4821.");
  const session = await prisma.discoverySession.findUnique({
    where: { code: input.code },
    include: { participants: true },
  });
  if (!session) throw new HttpError(404, OPAQUE_SESSION);
  if (session.status === "archived") throw new HttpError(400, "That session is archived.");
  const seat = session.participants.find((participant) => participant.role === input.role);
  if (seat && !seat.leftAt) {
    throw new HttpError(409, `Participant ${input.role} is already ${seat.displayName}. Use the other seat, or rejoin if that is you.`);
  }
  if (seat?.leftAt) {
    throw new HttpError(409, `That seat is reserved for ${seat.displayName}. Rejoin with the recovery key from the original browser.`);
  }
  const communityRole = session.purpose === "community" ? (input.role === "A" ? "facilitator" : "participant") : "";
  const participant = await prisma.participant.create({
    data: {
      sessionId: session.id,
      displayName: input.displayName,
      role: input.role,
      communityRole,
      token: `pending:${createToken()}`,
    },
  });
  const issued = await issueCredential(participant.id, "recovery", recoveryTtlMs());
  await recordEvent(session.id, {
    type: "participant.joined",
    message: session.purpose === "community"
      ? `${participant.displayName} joined as ${communityRole}. Neither person decides the other's meaning.`
      : `${participant.displayName} joined as participant ${participant.role}.`,
    participantId: participant.id,
  });
  return {
    code: session.code,
    sessionId: session.id,
    token: issued.token,
    expiresAt: issued.expiresAt.toISOString(),
    participantId: participant.id,
    role: participant.role,
    displayName: participant.displayName,
  };
}

export async function rejoinSession(input: z.infer<typeof rejoinSessionSchema>) {
  if (!isSessionCode(input.code)) throw new HttpError(400, "Session codes look like TREE-4821.");
  const [session, resolved] = await Promise.all([
    prisma.discoverySession.findUnique({ where: { code: input.code } }),
    resolvePresented(input.token),
  ]);
  if (!session || !resolved || resolved.participant.sessionId !== session.id) {
    throw new HttpError(404, OPAQUE_SESSION);
  }
  if (resolved.failure === "revoked") {
    const newer = resolved.createdAt
      ? await prisma.accessCredential.count({
        where: { participantId: resolved.participant.id, createdAt: { gt: resolved.createdAt } },
      })
      : 1;
    if (newer > 0 || !resolved.participant.leftAt) {
      throw new HttpError(401, "This recovery key has been replaced.");
    }
  }
  const issued = await renewCredential(resolved.participant.id);
  const updated = await prisma.participant.update({
    where: { id: resolved.participant.id },
    data: { displayName: input.displayName?.trim() || resolved.participant.displayName },
  });
  await recordEvent(session.id, {
    type: "participant.rejoined",
    message: `${updated.displayName} rejoined as participant ${updated.role}.`,
    participantId: updated.id,
  });
  return {
    code: session.code,
    sessionId: session.id,
    token: issued.token,
    expiresAt: issued.expiresAt.toISOString(),
    participantId: updated.id,
    role: updated.role,
    displayName: updated.displayName,
  };
}

export async function leaveSession(code: string, token: string | null) {
  const { session, participant } = await requireParticipant(code, token);
  await prisma.accessCredential.updateMany({
    where: { participantId: participant.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.participant.update({ where: { id: participant.id }, data: { leftAt: new Date() } });
  await recordEvent(session.id, {
    type: "participant.left",
    message: `${participant.displayName} left the session. The seat stays reserved for their recovery key.`,
    participantId: participant.id,
  });
  return { ok: true };
}

export async function listSessionsForToken(token: string | null) {
  const resolved = await resolvePresented(token);
  if (!token || !resolved) throw new HttpError(401, "Join a session before looking one up. Session codes are not listed.");
  if (resolved.failure === "left" || (resolved.failure === "revoked" && resolved.participant.leftAt)) {
    throw new HttpError(403, "You left this session. Rejoin before continuing.");
  }
  if (resolved.failure === "expired") throw new HttpError(401, "This recovery key has expired.");
  if (resolved.failure === "revoked") throw new HttpError(401, "This recovery key has been replaced.");
  const session = await prisma.discoverySession.findUnique({
    where: { id: resolved.participant.sessionId },
    include: { participants: true, concepts: true, _count: { select: { evidence: true } } },
  });
  if (!session) return [];
  return [sessionSummary(session)];
}

function sessionSummary(session: {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  isDemo: boolean;
  isIllustrative: boolean;
  updatedAt: Date;
  participants: Array<{ displayName: string; role: string; leftAt: Date | null }>;
  concepts: Array<{ status: string }>;
  _count: { evidence: number };
}) {
  return {
    id: session.id,
    code: session.code,
    name: session.name,
    description: session.description,
    status: session.status,
    isDemo: session.isDemo,
    isIllustrative: session.isIllustrative,
    updatedAt: session.updatedAt.toISOString(),
    participants: session.participants.map((participant) => ({
      displayName: participant.displayName,
      role: participant.role,
      left: Boolean(participant.leftAt),
    })),
    concepts: session.concepts.length,
    verified: session.concepts.filter((concept) => concept.status === "verified").length,
    pending: session.concepts.filter((concept) => concept.status !== "verified" && concept.status !== "archived").length,
    evidence: session._count.evidence,
  };
}

export async function updateSession(code: string, token: string | null, input: z.infer<typeof sessionPatchSchema>) {
  const { session, participant } = await requireParticipant(code, token);
  const archived = input.action === "archive";
  const restored = input.action === "restore";
  await prisma.discoverySession.update({
    where: { id: session.id },
    data: {
      name: input.name ?? session.name,
      description: input.description ?? session.description,
      objective: input.objective ?? session.objective,
      status: archived ? "archived" : restored ? "active" : session.status,
      archivedAt: archived ? session.archivedAt ?? new Date() : restored ? null : session.archivedAt,
    },
  });
  await recordEvent(session.id, {
    type: archived ? "session.archived" : restored ? "session.restored" : "session.updated",
    message: archived
      ? `${participant.displayName} archived the session. The record stays on this computer.`
      : restored
        ? `${participant.displayName} restored the session.`
        : `${participant.displayName} updated the session notes.`,
    participantId: participant.id,
  });
  return { ok: true };
}

export async function deleteSession(code: string, token: string | null, confirmCode: string) {
  const { session, participant } = await requireParticipant(code, token);
  if (confirmCode.trim().toUpperCase() !== session.code) {
    throw new HttpError(400, "Type the session code to confirm deletion.");
  }
  await removeUploadDir(session.id);
  await prisma.discoverySession.delete({ where: { id: session.id } });
  return { ok: true, deletedBy: participant.displayName };
}
