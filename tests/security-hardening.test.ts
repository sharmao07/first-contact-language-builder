import { afterEach, describe, expect, it } from "vitest";
import { OPAQUE_SESSION, hashToken, renewCredential, resolvePresented } from "@/lib/access/credentials";
import { canMutateHypotheses } from "@/lib/access/policy";
import { prisma } from "@/lib/database/prisma";
import { requireParticipant } from "@/lib/domain/common";
import { respondToHypothesis } from "@/lib/domain/discovery";
import { createSession, listSessionsForToken } from "@/lib/domain/session";
import { assertDemoOperator, demoOperatorGate } from "@/lib/demo/operator";
import { HttpError } from "@/lib/http";
import { createSessionSchema } from "@/lib/validation/schemas";

const original = {
  allow: process.env.ALLOW_DEMO_OPERATOR,
  secret: process.env.DEMO_OPERATOR_SECRET,
  vercel: process.env.VERCEL_ENV,
  disabled: process.env.DEMO_OPERATOR_DISABLED,
};

afterEach(() => {
  if (original.allow === undefined) delete process.env.ALLOW_DEMO_OPERATOR;
  else process.env.ALLOW_DEMO_OPERATOR = original.allow;
  if (original.secret === undefined) delete process.env.DEMO_OPERATOR_SECRET;
  else process.env.DEMO_OPERATOR_SECRET = original.secret;
  if (original.vercel === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = original.vercel;
  if (original.disabled === undefined) delete process.env.DEMO_OPERATOR_DISABLED;
  else process.env.DEMO_OPERATOR_DISABLED = original.disabled;
});

async function shoreCounts() {
  const session = await prisma.discoverySession.findUnique({
    where: { code: "SHORE-1001" },
    include: { _count: { select: { concepts: true, evidence: true } } },
  });
  return { concepts: session?._count.concepts ?? 0, evidence: session?._count.evidence ?? 0 };
}

describe("demo operator gate", () => {
  it("is disabled unless local operator configuration is explicit", () => {
    delete process.env.ALLOW_DEMO_OPERATOR;
    delete process.env.DEMO_OPERATOR_SECRET;
    delete process.env.VERCEL_ENV;
    expect(demoOperatorGate().available).toBe(false);
    process.env.ALLOW_DEMO_OPERATOR = "1";
    process.env.DEMO_OPERATOR_SECRET = "short";
    expect(demoOperatorGate().available).toBe(false);
    process.env.DEMO_OPERATOR_SECRET = "local-operator-secret-value";
    expect(demoOperatorGate().available).toBe(true);
    process.env.VERCEL_ENV = "production";
    expect(demoOperatorGate().available).toBe(false);
  });

  it("refuses a cross-origin reset before any session is changed", async () => {
    const before = await shoreCounts();
    process.env.ALLOW_DEMO_OPERATOR = "1";
    process.env.DEMO_OPERATOR_SECRET = "local-operator-secret-value";
    delete process.env.VERCEL_ENV;
    const request = new Request("http://127.0.0.1:3010/api/demo/reset", {
      method: "POST",
      headers: { origin: "https://evil.example", "x-demo-operator": "local-operator-secret-value" },
    });
    expect(() => assertDemoOperator(request)).toThrow(HttpError);
    try {
      assertDemoOperator(request);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(403);
    }
    expect(await shoreCounts()).toEqual(before);
  });

  it("does not reset when the route is loaded or called without the operator secret", async () => {
    const before = await shoreCounts();
    const { POST } = await import("@/app/api/demo/reset/route");
    expect(await shoreCounts()).toEqual(before);
    delete process.env.ALLOW_DEMO_OPERATOR;
    const disabled = await POST(new Request("http://127.0.0.1:3010/api/demo/reset", { method: "POST" }));
    expect(disabled.status).toBe(403);
    process.env.ALLOW_DEMO_OPERATOR = "1";
    process.env.DEMO_OPERATOR_SECRET = "local-operator-secret-value";
    delete process.env.VERCEL_ENV;
    const denied = await POST(new Request("http://127.0.0.1:3010/api/demo/reset", {
      method: "POST",
      headers: { "x-demo-operator": "not-the-operator-secret-value", origin: "http://127.0.0.1:3010" },
    }));
    expect(denied.status).toBe(401);
    const body = await denied.json();
    expect(JSON.stringify(body)).not.toContain("demo-shore");
    expect(await shoreCounts()).toEqual(before);
    expect(before.concepts).toBe(8);
  });
});

describe("recovery credentials", () => {
  it("stores a hash, expires, replaces, and keeps a legacy key until renewal", async () => {
    const created = await createSession(createSessionSchema.parse({
      name: "Credential lifecycle",
      displayName: "Ada",
      role: "A",
      purpose: "general",
    }));
    const other = await createSession(createSessionSchema.parse({
      name: "Credential other",
      displayName: "Cam",
      role: "A",
      purpose: "general",
    }));
    try {
      const stored = await prisma.participant.findUniqueOrThrow({ where: { id: created.participantId } });
      expect(stored.token).not.toBe(created.token);
      expect(stored.token.startsWith("issued:")).toBe(true);
      const saved = await prisma.accessCredential.findUniqueOrThrow({ where: { tokenHash: hashToken(created.token) } });
      expect(saved.tokenHash).not.toContain(created.token);
      const listed = await listSessionsForToken(created.token);
      expect(JSON.stringify(listed)).not.toContain(created.token);

      await prisma.accessCredential.update({
        where: { id: saved.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect((await resolvePresented(created.token))?.failure).toBe("expired");
      await prisma.accessCredential.update({
        where: { id: saved.id },
        data: { expiresAt: new Date(Date.now() + 60_000) },
      });

      const renewed = await renewCredential(created.participantId);
      expect((await resolvePresented(created.token))?.failure).toBe("revoked");
      expect((await resolvePresented(renewed.token))?.failure).toBeNull();

      const cross = requireParticipant(other.code, renewed.token);
      const unknown = requireParticipant("TREE-0000", null);
      const invalid = requireParticipant(created.code, "not-a-real-token");
      const [crossError, unknownError, invalidError] = await Promise.all([
        cross.catch((error: HttpError) => error),
        unknown.catch((error: HttpError) => error),
        invalid.catch((error: HttpError) => error),
      ]);
      for (const error of [crossError, unknownError, invalidError]) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).status).toBe(404);
        expect((error as HttpError).message).toBe(OPAQUE_SESSION);
      }

      await prisma.accessCredential.deleteMany({ where: { participantId: created.participantId } });
      await prisma.participant.update({
        where: { id: created.participantId },
        data: { token: "legacy-token-value-0123456789", leftAt: null },
      });
      const legacy = await resolvePresented("legacy-token-value-0123456789");
      expect(legacy?.legacy).toBe(true);
      expect(legacy?.failure).toBeNull();
      const replaced = await renewCredential(created.participantId);
      expect(await resolvePresented("legacy-token-value-0123456789")).toBeNull();
      expect((await resolvePresented(replaced.token))?.failure).toBeNull();

      const participant = await requireParticipant(created.code, replaced.token);
      await expect(respondToHypothesis(other.code, replaced.token, "missing-hypothesis", {
        action: "accept",
        note: "",
      })).rejects.toMatchObject({ status: 404, message: OPAQUE_SESSION });
      expect(canMutateHypotheses({
        purpose: participant.session.purpose,
        role: participant.participant.role,
        communityRole: participant.participant.communityRole,
      })).toBe(true);
      expect(canMutateHypotheses({ purpose: "community", role: "B", communityRole: "participant" })).toBe(false);
      expect(canMutateHypotheses({ purpose: "general", role: "B", communityRole: "" })).toBe(false);
    } finally {
      await prisma.discoverySession.deleteMany({ where: { code: { in: [created.code, other.code] } } });
    }
  });
});
