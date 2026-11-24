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
  const token = createToken();
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
          token,
        },
      },
    },
    include: { participants: true },
  });
  const participant = session.participants[0];
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
    token,
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
  if (!session) throw new HttpError(404, "No session uses that code.");
  if (session.status === "archived") throw new HttpError(400, "That session is archived.");
  const seat = session.participants.find((participant) => participant.role === input.role);
  if (seat && !seat.leftAt) {
    throw new HttpError(409, `Participant ${input.role} is already ${seat.displayName}. Use the other seat, or rejoin if that is you.`);
  }
  if (seat?.leftAt) {
    throw new HttpError(409, `That seat is reserved for ${seat.displayName}. Rejoin with the recovery key from the original browser.`);
  }
  const token = createToken();
  const communityRole = session.purpose === "community" ? (input.role === "A" ? "facilitator" : "participant") : "";
  const participant = await prisma.participant.create({
    data: {
      sessionId: session.id,
      displayName: input.displayName,
      role: input.role,
      communityRole,
      token,
    },
  });
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
    token,
    participantId: participant.id,
    role: participant.role,
    displayName: participant.displayName,
  };
}

export async function rejoinSession(input: z.infer<typeof rejoinSessionSchema>) {
  if (!isSessionCode(input.code)) throw new HttpError(400, "Session codes look like TREE-4821.");
  const session = await prisma.discoverySession.findUnique({ where: { code: input.code } });
  if (!session) throw new HttpError(404, "No session uses that code.");
  const participant = await prisma.participant.findUnique({ where: { token: input.token } });
  if (!participant || participant.sessionId !== session.id) {
    throw new HttpError(403, "That recovery key does not match this session.");
  }
  const updated = await prisma.participant.update({
    where: { id: participant.id },
    data: {
      leftAt: null,
      lastSeenAt: new Date(),
      displayName: input.displayName?.trim() || participant.displayName,
    },
  });
  await recordEvent(session.id, {
    type: "participant.rejoined",
    message: `${updated.displayName} rejoined as participant ${updated.role}.`,
    participantId: updated.id,
  });
  return {
    code: session.code,
    sessionId: session.id,
    token: updated.token,
    participantId: updated.id,
    role: updated.role,
    displayName: updated.displayName,
  };
}

export async function leaveSession(code: string, token: string | null) {
  const { session, participant } = await requireParticipant(code, token);
  await prisma.participant.update({ where: { id: participant.id }, data: { leftAt: new Date() } });
  await recordEvent(session.id, {
    type: "participant.left",
    message: `${participant.displayName} left the session. The seat stays reserved for their recovery key.`,
    participantId: participant.id,
  });
  return { ok: true };
}

export async function listSessions() {
  const sessions = await prisma.discoverySession.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      participants: true,
      concepts: true,
      _count: { select: { evidence: true } },
    },
  });
  return sessions.map((session) => ({
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
  }));
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
