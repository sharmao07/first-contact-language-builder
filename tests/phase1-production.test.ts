import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { OPAQUE_SESSION, resolvePresented } from "@/lib/access/credentials";
import { prisma } from "@/lib/database/prisma";
import { seedIllustrativeSession } from "@/lib/demo/illustrative";
import { createSession, joinSession } from "@/lib/domain/session";
import { buildHealthReport, healthHttpStatus } from "@/lib/health/report";
import { HttpError } from "@/lib/http";
import { mediaSignatureValid, signMediaPath } from "@/lib/media/sign";
import {
  enforceRateLimit,
  rateLimitStatus,
  setRateLimitStoreForTests,
  type RateLimitStore,
} from "@/lib/security/rate-limit";
import { getObjectStore, storageStatus } from "@/lib/storage";
import { createSessionSchema, joinSessionSchema } from "@/lib/validation/schemas";
import { assessEnvironment, verifyMigrationsReady } from "../scripts/check-env.mjs";

const envBackup = {
  VERCEL: process.env.VERCEL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
  MEDIA_SIGNING_SECRET: process.env.MEDIA_SIGNING_SECRET,
  RATE_LIMIT_STORE: process.env.RATE_LIMIT_STORE,
  RATE_LIMIT_SESSION_CREATE_MAX: process.env.RATE_LIMIT_SESSION_CREATE_MAX,
  RATE_LIMIT_SESSION_JOIN_MAX: process.env.RATE_LIMIT_SESSION_JOIN_MAX,
  RATE_LIMIT_EVIDENCE_UPLOAD_MAX: process.env.RATE_LIMIT_EVIDENCE_UPLOAD_MAX,
  RATE_LIMIT_AI_MAX: process.env.RATE_LIMIT_AI_MAX,
};

afterEach(() => {
  setRateLimitStoreForTests(null);
  for (const [key, val] of Object.entries(envBackup)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
});

function memoryBackedTestStore(): RateLimitStore {
  const counts = new Map<string, number>();
  return {
    async increment(key) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    async ping() {
      return;
    },
  };
}

describe("distributed rate limiting", () => {
  it("allows normal traffic, enforces 429 on repeated bursts, and isolates limits by action", async () => {
    setRateLimitStoreForTests(memoryBackedTestStore());
    process.env.RATE_LIMIT_SESSION_CREATE_MAX = "2";
    process.env.RATE_LIMIT_SESSION_JOIN_MAX = "3";

    const req = () =>
      new Request("https://app.example/api/sessions", {
        method: "POST",
        headers: { "x-vercel-forwarded-for": "203.0.113.10" },
      });

    const first = await enforceRateLimit({ action: "session_create", request: req(), nowMs: 1_700_000_000_000 });
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    const second = await enforceRateLimit({ action: "session_create", request: req(), nowMs: 1_700_000_001_000 });
    expect(second.remaining).toBe(0);

    await expect(
      enforceRateLimit({ action: "session_create", request: req(), nowMs: 1_700_000_002_000 }),
    ).rejects.toMatchObject({
      status: 429,
      headers: expect.objectContaining({
        "Retry-After": expect.any(String),
        "X-RateLimit-Remaining": "0",
      }),
    });

    // Separate limit for session_join from the same IP still succeeds.
    const joinRes = await enforceRateLimit({
      action: "session_join",
      request: req(),
      code: "TREE-4821",
      nowMs: 1_700_000_002_000,
    });
    expect(joinRes.allowed).toBe(true);
  });

  it("prevents bypass via IP rotation on targeted session codes and actor tokens", async () => {
    setRateLimitStoreForTests(memoryBackedTestStore());
    process.env.RATE_LIMIT_SESSION_JOIN_MAX = "2";
    process.env.RATE_LIMIT_EVIDENCE_UPLOAD_MAX = "2";

    const makeJoinReq = (ip: string) =>
      new Request("https://app.example/api/sessions/join", {
        method: "POST",
        headers: { "x-vercel-forwarded-for": ip },
      });

    await enforceRateLimit({ action: "session_join", request: makeJoinReq("198.51.100.1"), code: "tree-4821", nowMs: 1_700_000_000_000 });
    await enforceRateLimit({ action: "session_join", request: makeJoinReq("198.51.100.2"), code: "TREE-4821", nowMs: 1_700_000_001_000 });
    await expect(
      enforceRateLimit({ action: "session_join", request: makeJoinReq("198.51.100.3"), code: " Tree-4821 ", nowMs: 1_700_000_002_000 }),
    ).rejects.toMatchObject({ status: 429 });

    // Rotating IPs with the same participant token also triggers 429 on evidence uploads.
    await enforceRateLimit({ action: "evidence_upload", request: makeJoinReq("198.51.100.10"), token: "seat-token-abc", nowMs: 1_700_000_000_000 });
    await enforceRateLimit({ action: "evidence_upload", request: makeJoinReq("198.51.100.11"), token: "seat-token-abc", nowMs: 1_700_000_001_000 });
    await expect(
      enforceRateLimit({ action: "evidence_upload", request: makeJoinReq("198.51.100.12"), token: "seat-token-abc", nowMs: 1_700_000_002_000 }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("fails closed with 503 when the distributed limiter store fails or is invalid", async () => {
    setRateLimitStoreForTests({
      async increment() {
        throw new Error("Redis connection refused");
      },
      async ping() {
        throw new Error("Redis connection refused");
      },
    });
    const req = new Request("https://app.example/api/sessions", { method: "POST" });
    await expect(enforceRateLimit({ action: "session_create", request: req })).rejects.toMatchObject({
      status: 503,
    });
    const status = await rateLimitStatus();
    expect(status.available).toBe(false);

    setRateLimitStoreForTests(null);
    process.env.RATE_LIMIT_STORE = "memory";
    await expect(enforceRateLimit({ action: "session_create", request: req })).rejects.toMatchObject({
      status: 503,
    });
  });

  it("exercises atomic SQLite RateLimitBucket persistence end-to-end", async () => {
    const uniqueIp = `192.0.2.${Math.floor(Math.random() * 200) + 10}`;
    process.env.RATE_LIMIT_AI_MAX = "2";
    const req = new Request("http://127.0.0.1:3010/api/sessions/SHORE-1001/analyze", {
      method: "POST",
      headers: { "x-real-ip": uniqueIp },
    });
    try {
      const r1 = await enforceRateLimit({ action: "ai_plan", request: req, token: `tok-${uniqueIp}` });
      expect(r1.remaining).toBe(1);
      const r2 = await enforceRateLimit({ action: "ai_plan", request: req, token: `tok-${uniqueIp}` });
      expect(r2.remaining).toBe(0);
      await expect(enforceRateLimit({ action: "ai_plan", request: req, token: `tok-${uniqueIp}` })).rejects.toMatchObject({ status: 429 });
    } finally {
      await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: "ai_plan:" } } });
    }
  });
});

describe("legacy sample credential isolation", () => {
  it("rejects legacy sample credentials in hosted/Vercel/Postgres environments", async () => {
    // Local SQLite dev still recognizes SHORE-1001, but hosted environments reject sample tokens.
    process.env.VERCEL_ENV = "production";
    expect(await resolvePresented("demo-shore-1001-participant-a")).toBeNull();
    expect(await resolvePresented("demo-shore-1001-participant-b")).toBeNull();

    delete process.env.VERCEL_ENV;
    process.env.VERCEL = "1";
    expect(await resolvePresented("demo-shore-1001-participant-a")).toBeNull();

    await expect(seedIllustrativeSession()).rejects.toThrow(/Refusing to seed/);
  });

  it("keeps local SHORE-1001 sample intact", async () => {
    const shore = await prisma.discoverySession.findUnique({
      where: { code: "SHORE-1001" },
      include: { _count: { select: { concepts: true, evidence: true } } },
    });
    expect(shore).not.toBeNull();
    expect(shore?._count.concepts).toBe(8);
    expect(shore?._count.evidence).toBe(8);
  });
});

describe("production readiness, migrations, and secrets", () => {
  it("rejects missing production config, leaked NEXT_PUBLIC secrets, and in-memory rate limiters", () => {
    const validProd = {
      DATABASE_URL: "postgresql://user:pass@aws-0.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1",
      DIRECT_URL: "postgresql://user:pass@db.example.supabase.co:5432/postgres",
      STORAGE_PROVIDER: "supabase",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-value",
      SUPABASE_STORAGE_BUCKET: "session-media",
      MEDIA_SIGNING_SECRET: "0123456789abcdef0123456789",
      RATE_LIMIT_STORE: "database",
      AI_PROVIDER: "demo",
    };
    expect(assessEnvironment(validProd, "production").ok).toBe(true);

    expect(assessEnvironment({ ...validProd, RATE_LIMIT_STORE: "memory" }, "production").ok).toBe(false);
    expect(assessEnvironment({ ...validProd, ALLOW_DEMO_OPERATOR: "1" }, "production").ok).toBe(false);
    expect(
      assessEnvironment({ ...validProd, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-value" }, "production").ok,
    ).toBe(false);
    expect(
      assessEnvironment({ ...validProd, NEXT_PUBLIC_LEAK: "0123456789abcdef0123456789" }, "production").ok,
    ).toBe(false);
  });

  it("keeps all PostgreSQL migrations non-destructive and applies cleanly in PGlite", async () => {
    const check = verifyMigrationsReady(".");
    expect(check.ok).toBe(true);
    const db = new PGlite();
    await db.exec(fs.readFileSync("prisma/migrations/20261124220325_init/migration.sql", "utf8"));
    const rlSql = fs.readFileSync("prisma/migrations/20261126213500_add_rate_limit_buckets/migration.sql", "utf8");
    expect(rlSql.toLowerCase()).not.toContain("drop ");
    expect(rlSql.toLowerCase()).not.toContain("delete ");
    expect(rlSql.toLowerCase()).not.toContain("truncate ");
    await db.exec(rlSql);
    const rlsSql = fs.readFileSync("prisma/migrations/20261127195500_harden_rls_and_privileges/migration.sql", "utf8");
    expect(rlsSql.toLowerCase()).not.toContain("drop ");
    expect(rlsSql.toLowerCase()).not.toContain("delete ");
    expect(rlsSql.toLowerCase()).not.toContain("truncate ");
    await db.exec(rlsSql);
    const fnSql = fs.readFileSync(
      "prisma/migrations/20261127200000_revoke_global_function_default_execute/migration.sql",
      "utf8",
    );
    expect(fnSql.toLowerCase()).not.toContain("drop ");
    expect(fnSql.toLowerCase()).not.toContain("delete ");
    expect(fnSql.toLowerCase()).not.toContain("truncate ");
    await db.exec(fnSql);
    const tables = await db.query<{ tablename: string; rowsecurity: boolean }>(
      `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    expect(tables.rows).toHaveLength(20);
    expect(tables.rows.every((row) => row.rowsecurity === true)).toBe(true);
    await db.close();
  });

  it("reports unhealthy (503) when production storage or rate limit is unconfigured", async () => {
    process.env.VERCEL = "1";
    delete process.env.STORAGE_PROVIDER;
    const status = await storageStatus();
    expect(status.configured).toBe(false);
    expect(() => getObjectStore()).toThrow(/not configured/);

    const report = await buildHealthReport();
    expect(report.ok).toBe(false);
    expect(healthHttpStatus(report)).toBe(503);
  });
});

describe("media signing and session error handling", () => {
  it("enforces HMAC signature validation and expiry", () => {
    process.env.MEDIA_SIGNING_SECRET = "signing-secret-at-least-16";
    const signedPath = signMediaPath("ev-123", 1_700_000_000_000);
    expect(signedPath).toContain("/api/media/ev-123");
    const url = new URL(signedPath!, "http://localhost");
    const exp = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");

    expect(mediaSignatureValid("ev-123", exp, sig, 1_700_000_000_000)).toBe(true);
    expect(mediaSignatureValid("ev-999", exp, sig, 1_700_000_000_000)).toBe(false);
    expect(mediaSignatureValid("ev-123", exp, sig, 1_700_000_000_000 + 20 * 60 * 1000)).toBe(false);
  });

  it("validates session creation/join errors without revealing occupant names", async () => {
    expect(() => createSessionSchema.parse({ name: "", displayName: "Ada", role: "A" })).toThrow();
    await expect(
      joinSession(joinSessionSchema.parse({ code: "TREE-0000", displayName: "Bao", role: "B" })),
    ).rejects.toMatchObject({ status: 404, message: OPAQUE_SESSION });

    const created = await createSession(
      createSessionSchema.parse({ name: "Join check", displayName: "SecretOccupantName", role: "A", purpose: "general" }),
    );
    try {
      const err = await joinSession(joinSessionSchema.parse({ code: created.code, displayName: "Bao", role: "A" })).catch(
        (e: HttpError) => e,
      );
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(409);
      expect((err as HttpError).message).not.toContain("SecretOccupantName");
    } finally {
      await prisma.discoverySession.delete({ where: { code: created.code } });
    }
  });

  it("enforces HTTP 429 on POST /api/sessions and enforces media route authorization", async () => {
    setRateLimitStoreForTests(memoryBackedTestStore());
    process.env.RATE_LIMIT_SESSION_CREATE_MAX = "1";
    const { POST: createRoute } = await import("@/app/api/sessions/route");
    const firstReq = new Request("http://127.0.0.1:3010/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-vercel-forwarded-for": "203.0.113.55" },
      body: JSON.stringify({ name: "RL route test", displayName: "Ada", role: "A", purpose: "general" }),
    });
    const firstRes = await createRoute(firstReq);
    expect(firstRes.status).toBe(201);
    const created = (await firstRes.json()) as { code: string; token: string };
    try {
      const secondReq = new Request("http://127.0.0.1:3010/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json", "x-vercel-forwarded-for": "203.0.113.55" },
        body: JSON.stringify({ name: "RL route test 2", displayName: "Ada", role: "A", purpose: "general" }),
      });
      const secondRes = await createRoute(secondReq);
      expect(secondRes.status).toBe(429);
      expect(secondRes.headers.get("Retry-After")).toBeTruthy();

      // Media route authorization: rejects missing/invalid signature & missing token with 404.
      const { GET: mediaRoute } = await import("@/app/api/media/[id]/route");
      const mediaForbidden = await mediaRoute(new Request("http://127.0.0.1:3010/api/media/demo_ev_tone"), {
        params: Promise.resolve({ id: "demo_ev_tone" }),
      });
      expect(mediaForbidden.status).toBe(404);

      process.env.MEDIA_SIGNING_SECRET = "signing-secret-at-least-16";
      const signed = signMediaPath("demo_ev_tone");
      const mediaAllowed = await mediaRoute(new Request(`http://127.0.0.1:3010${signed}`), {
        params: Promise.resolve({ id: "demo_ev_tone" }),
      });
      expect(mediaAllowed.status).toBe(200);
      expect(mediaAllowed.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(mediaAllowed.headers.get("Content-Security-Policy")).toBe("sandbox");
    } finally {
      await prisma.discoverySession.delete({ where: { code: created.code } });
    }
  });
});
