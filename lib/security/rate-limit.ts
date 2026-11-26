import crypto from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import { HttpError } from "@/lib/http";
import { databaseKind } from "@/lib/storage";

export type RateLimitAction =
  | "session_create"
  | "session_join"
  | "session_rejoin"
  | "evidence_upload"
  | "ai_plan";

export type RateLimitPolicy = {
  max: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtSeconds: number;
  retryAfterSeconds: number;
};

export type RateLimitStatus = {
  provider: "redis" | "database" | "invalid";
  configured: boolean;
  available: boolean;
  detail: string;
};

export type RateLimitStore = {
  increment(bucketKey: string, windowMs: number, nowMs: number): Promise<number>;
  ping(): Promise<void>;
};

const DEFAULT_POLICIES: Record<RateLimitAction, RateLimitPolicy> = {
  session_create: { max: 20, windowSeconds: 900 },
  session_join: { max: 30, windowSeconds: 900 },
  session_rejoin: { max: 20, windowSeconds: 900 },
  evidence_upload: { max: 60, windowSeconds: 900 },
  ai_plan: { max: 40, windowSeconds: 900 },
};

const ENV_PREFIX: Record<RateLimitAction, string> = {
  session_create: "RATE_LIMIT_SESSION_CREATE",
  session_join: "RATE_LIMIT_SESSION_JOIN",
  session_rejoin: "RATE_LIMIT_SESSION_REJOIN",
  evidence_upload: "RATE_LIMIT_EVIDENCE_UPLOAD",
  ai_plan: "RATE_LIMIT_AI",
};

const LUA_INCR_EXPIRE = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return current
`;

let customStoreForTests: RateLimitStore | null = null;

export function setRateLimitStoreForTests(store: RateLimitStore | null) {
  customStoreForTests = store;
}

export function policyForAction(action: RateLimitAction): RateLimitPolicy {
  const base = DEFAULT_POLICIES[action];
  const prefix = ENV_PREFIX[action];
  const rawMax = Number(process.env[`${prefix}_MAX`] ?? base.max);
  const rawWindow = Number(process.env[`${prefix}_WINDOW_SEC`] ?? base.windowSeconds);
  const max = Number.isFinite(rawMax) && rawMax >= 1 ? Math.min(10_000, Math.floor(rawMax)) : base.max;
  const windowSeconds = Number.isFinite(rawWindow) && rawWindow >= 10 ? Math.min(86_400, Math.floor(rawWindow)) : base.windowSeconds;
  return { max, windowSeconds };
}

function hashIdentifier(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function extractClientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "unknown";
}

function redisConfig() {
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "").trim().replace(/\/$/, "");
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "").trim();
  if (!url && !token) return null;
  if (!url.startsWith("https://") || !token) return { invalid: true as const };
  return { invalid: false as const, url, token };
}

export function selectedRateLimitProvider(): "redis" | "database" | "invalid" {
  const explicit = process.env.RATE_LIMIT_STORE?.trim().toLowerCase() ?? "";
  if (explicit === "memory" || explicit === "off" || explicit === "none") return "invalid";
  if (explicit && explicit !== "auto" && explicit !== "redis" && explicit !== "database") return "invalid";
  const redis = redisConfig();
  if (explicit === "redis") return redis && !redis.invalid ? "redis" : "invalid";
  if (explicit === "database") return "database";
  if (redis) return redis.invalid ? "invalid" : "redis";
  return "database";
}

function makeRedisStore(url: string, token: string): RateLimitStore {
  return {
    async increment(bucketKey, windowMs) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(["EVAL", LUA_INCR_EXPIRE, "1", `fclb:rl:${bucketKey}`, String(windowMs)]),
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error(`Redis rate limit HTTP ${response.status}`);
      const payload = (await response.json()) as { result?: unknown; error?: string };
      if (payload.error) throw new Error(payload.error);
      const count = Number(payload.result);
      if (!Number.isFinite(count) || count < 1) throw new Error("Invalid Redis counter result.");
      return count;
    },
    async ping() {
      const response = await fetch(`${url}/ping`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error(`Redis ping HTTP ${response.status}`);
    },
  };
}

const databaseStore: RateLimitStore = {
  async increment(bucketKey, windowMs, nowMs) {
    const windowId = Math.floor(nowMs / windowMs);
    const expiresAtMs = (windowId + 1) * windowMs;
    const kind = databaseKind();
    let count = 0;

    if (kind === "postgresql") {
      const expiresAt = new Date(expiresAtMs);
      const rows = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
        INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt", "updatedAt")
        VALUES (${bucketKey}, 1, ${expiresAt}, NOW())
        ON CONFLICT ("key") DO UPDATE
        SET "count" = "RateLimitBucket"."count" + 1, "updatedAt" = NOW()
        RETURNING "count"
      `;
      count = Number(rows[0]?.count ?? 0);
    } else if (kind === "sqlite") {
      const rows = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
        INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt", "updatedAt")
        VALUES (${bucketKey}, 1, ${expiresAtMs}, ${nowMs})
        ON CONFLICT ("key") DO UPDATE
        SET "count" = "RateLimitBucket"."count" + 1, "updatedAt" = ${nowMs}
        RETURNING "count"
      `;
      count = Number(rows[0]?.count ?? 0);
    } else {
      throw new Error("Unsupported database provider for rate limiting.");
    }

    if (!Number.isFinite(count) || count < 1) {
      throw new Error("Rate limit bucket did not return a valid count.");
    }

    // Best-effort opportunistic pruning of expired windows.
    if (count === 1 && Math.random() < 0.05) {
      if (kind === "postgresql") {
        void prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "expiresAt" < NOW()`.catch(() => undefined);
      } else {
        void prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "expiresAt" < ${nowMs}`.catch(() => undefined);
      }
    }

    return count;
  },
  async ping() {
    await prisma.$queryRaw`SELECT 1 FROM "RateLimitBucket" LIMIT 1`;
  },
};

function resolveStore(): RateLimitStore {
  if (customStoreForTests) return customStoreForTests;
  const provider = selectedRateLimitProvider();
  if (provider === "redis") {
    const redis = redisConfig();
    if (!redis || redis.invalid) {
      throw new HttpError(503, "Rate limiting is not configured.");
    }
    return makeRedisStore(redis.url, redis.token);
  }
  if (provider === "database") {
    if (databaseKind() === "unknown") {
      throw new HttpError(503, "Rate limiting is not available.");
    }
    return databaseStore;
  }
  throw new HttpError(503, "Rate limiting configuration is invalid.");
}

export async function rateLimitStatus(): Promise<RateLimitStatus> {
  if (customStoreForTests) {
    try {
      await customStoreForTests.ping();
      return { provider: "redis", configured: true, available: true, detail: "Custom test rate limiter active." };
    } catch {
      return { provider: "redis", configured: true, available: false, detail: "Rate limiter could not be reached." };
    }
  }
  const provider = selectedRateLimitProvider();
  if (provider === "invalid") {
    return {
      provider: "invalid",
      configured: false,
      available: false,
      detail: "Rate limiter must use distributed storage (database or Upstash/Vercel KV Redis).",
    };
  }
  try {
    await resolveStore().ping();
    return {
      provider,
      configured: true,
      available: true,
      detail:
        provider === "redis"
          ? "Distributed Redis REST rate limiting is active."
          : "Distributed database-backed rate limiting is active.",
    };
  } catch {
    return {
      provider,
      configured: true,
      available: false,
      detail: "The distributed rate limit store could not be reached or has not been migrated.",
    };
  }
}

export async function enforceRateLimit(input: {
  action: RateLimitAction;
  request: Request;
  code?: string | null;
  token?: string | null;
  nowMs?: number;
}): Promise<RateLimitResult> {
  const nowMs = input.nowMs ?? Date.now();
  const policy = policyForAction(input.action);
  const windowMs = policy.windowSeconds * 1000;
  const windowId = Math.floor(nowMs / windowMs);
  const resetAtSeconds = Math.ceil(((windowId + 1) * windowMs) / 1000);
  const retryAfterSeconds = Math.max(1, resetAtSeconds - Math.floor(nowMs / 1000));

  const ip = extractClientIp(input.request);
  const normalizedCode = input.code?.trim().toUpperCase() || "";
  const presentedToken = input.token?.trim() || "";

  // Check multiple independent dimensions so IP rotation or casing variations
  // cannot trivially bypass limits on a targeted session code or participant key.
  const checks: Array<{ key: string; limit: number }> = [
    { key: `${input.action}:ip:${windowId}:${hashIdentifier(ip)}`, limit: policy.max },
  ];

  if ((input.action === "session_join" || input.action === "session_rejoin") && normalizedCode) {
    checks.push({
      key: `${input.action}:code:${windowId}:${hashIdentifier(normalizedCode)}`,
      limit: policy.max,
    });
  }

  if (input.action === "session_rejoin" && presentedToken) {
    checks.push({
      key: `${input.action}:token:${windowId}:${hashIdentifier(presentedToken)}`,
      limit: policy.max,
    });
  }

  if ((input.action === "evidence_upload" || input.action === "ai_plan") && presentedToken) {
    checks.push({
      key: `${input.action}:actor:${windowId}:${hashIdentifier(presentedToken)}`,
      limit: policy.max,
    });
  }

  if (input.action === "session_create") {
    const globalCeiling = Math.max(policy.max * 5, 100);
    checks.push({
      key: `${input.action}:global:${windowId}:all`,
      limit: globalCeiling,
    });
  }

  let store: RateLimitStore;
  try {
    store = resolveStore();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Rate limiting is temporarily unavailable.");
  }

  let worstRemaining = policy.max;

  for (const check of checks) {
    let count: number;
    try {
      count = await store.increment(check.key, windowMs, nowMs);
    } catch {
      // Fail closed: never allow requests to bypass protection if the store fails.
      throw new HttpError(503, "Rate limiting is temporarily unavailable. Please try again shortly.");
    }

    const remaining = Math.max(0, check.limit - count);
    if (count > check.limit) {
      throw new HttpError(429, "Too many requests. Please wait before trying again.", {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(check.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(resetAtSeconds),
      });
    }
    if (check.limit === policy.max) {
      worstRemaining = Math.min(worstRemaining, remaining);
    }
  }

  return {
    allowed: true,
    limit: policy.max,
    remaining: worstRemaining,
    resetAtSeconds,
    retryAfterSeconds,
  };
}
