import { createHash } from "crypto";
import { prisma } from "@/lib/database/prisma";
import { createToken } from "@/lib/session/codes";

export const OPAQUE_SESSION = "No session is available for this request.";

export type CredentialFailure = "expired" | "revoked" | "left";

export type ResolvedCredential = {
  participant: {
    id: string;
    sessionId: string;
    displayName: string;
    role: string;
    communityRole: string;
    token: string;
    leftAt: Date | null;
    createdAt: Date;
    lastSeenAt: Date;
  };
  failure: CredentialFailure | null;
  legacy: boolean;
  credentialId: string | null;
  createdAt: Date | null;
};

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function recoveryTtlMs() {
  const hours = Number(process.env.RECOVERY_TOKEN_TTL_HOURS ?? "168");
  const safe = Number.isFinite(hours) ? Math.min(24 * 30, Math.max(1, hours)) : 168;
  return safe * 60 * 60 * 1000;
}

export function demoEntryTtlMs() {
  const minutes = Number(process.env.DEMO_ENTRY_TTL_MINUTES ?? "120");
  const safe = Number.isFinite(minutes) ? Math.min(24 * 60, Math.max(5, minutes)) : 120;
  return safe * 60 * 1000;
}

export async function issueCredential(
  participantId: string,
  purpose: "recovery" | "demo",
  ttlMs: number,
  options?: { replaceStoredToken?: boolean },
) {
  if (purpose === "demo") {
    await prisma.accessCredential.updateMany({
      where: { participantId, purpose: "demo", revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  const token = createToken();
  const row = await prisma.accessCredential.create({
    data: {
      participantId,
      tokenHash: hashToken(token),
      purpose,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  if (options?.replaceStoredToken !== false) {
    await prisma.participant.update({
      where: { id: participantId },
      data: { token: `issued:${row.id}` },
    });
  }
  return { token, expiresAt: row.expiresAt, credentialId: row.id };
}

export async function revokeCredentials(participantId: string) {
  await prisma.accessCredential.updateMany({
    where: { participantId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function renewCredential(participantId: string) {
  await revokeCredentials(participantId);
  await prisma.participant.update({
    where: { id: participantId },
    data: { leftAt: null, lastSeenAt: new Date() },
  });
  return issueCredential(participantId, "recovery", recoveryTtlMs());
}

export async function resolvePresented(token: string | null | undefined): Promise<ResolvedCredential | null> {
  const presented = token?.trim() ?? "";
  const hashed = hashToken(presented || "missing");
  const [credential, legacy] = await Promise.all([
    prisma.accessCredential.findUnique({
      where: { tokenHash: hashed },
      include: { participant: true },
    }),
    presented.length >= 8 && !presented.startsWith("issued:")
      ? prisma.participant.findUnique({ where: { token: presented } })
      : prisma.participant.findFirst({ where: { id: "missing-token-placeholder" } }),
  ]);
  if (credential) {
    const failure = credential.revokedAt
      ? "revoked"
      : credential.expiresAt.getTime() <= Date.now()
        ? "expired"
        : credential.participant.leftAt
          ? "left"
          : null;
    return {
      participant: credential.participant,
      failure,
      legacy: false,
      credentialId: credential.id,
      createdAt: credential.createdAt,
    };
  }
  if (!legacy || presented.startsWith("issued:")) return null;
  return {
    participant: legacy,
    failure: legacy.leftAt ? "left" : null,
    legacy: true,
    credentialId: null,
    createdAt: null,
  };
}
