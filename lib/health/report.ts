import { getAIMode } from "@/lib/ai/config";
import { prisma } from "@/lib/database/prisma";
import { mediaSigningStatus } from "@/lib/media/sign";
import { rateLimitStatus, type RateLimitStatus } from "@/lib/security/rate-limit";
import { databaseKind, storageStatus, type StorageStatus } from "@/lib/storage";
import { syncTransport } from "@/lib/sync/transport";

export type HealthReport = {
  ok: boolean;
  mode: "demo" | "openai";
  application: { ready: boolean };
  environment: string;
  database: { connected: boolean; migrated: boolean; provider: "sqlite" | "postgresql" | "unknown" };
  storage: StorageStatus;
  media: { configured: boolean; detail: string };
  rateLimit: RateLimitStatus;
  sync: { transport: "stream" | "poll" };
  ai: { mode: "demo" | "openai"; configured: boolean; available: boolean; detail: string };
};

async function probeDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return { connected: false, migrated: false };
  }
  try {
    await prisma.$queryRaw`SELECT 1 FROM "DiscoverySession" LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM "RateLimitBucket" LIMIT 1`;
    return { connected: true, migrated: true };
  } catch {
    return { connected: true, migrated: false };
  }
}

async function probeAI(): Promise<HealthReport["ai"]> {
  const mode = getAIMode();
  if (mode === "demo") {
    return {
      mode,
      configured: true,
      available: true,
      detail: "Demo mode uses the local hypothesis engine. It does not call an external model.",
    };
  }
  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/models`, {
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(4000),
    });
    return {
      mode,
      configured: true,
      available: response.ok,
      detail: response.ok ? "The configured provider responded." : "The configured provider rejected the request.",
    };
  } catch {
    return {
      mode,
      configured: true,
      available: false,
      detail: "The configured provider could not be reached.",
    };
  }
}

export function healthHttpStatus(report: { ok: boolean }) {
  return report.ok ? 200 : 503;
}

export async function buildHealthReport(): Promise<HealthReport> {
  const [db, storage, rateLimit, ai] = await Promise.all([
    probeDatabase(),
    storageStatus(),
    rateLimitStatus(),
    probeAI(),
  ]);
  const media = mediaSigningStatus();
  const ok =
    db.connected &&
    db.migrated &&
    storage.configured &&
    storage.available &&
    storage.persistent &&
    media.configured &&
    rateLimit.configured &&
    rateLimit.available;
  return {
    ok,
    mode: ai.mode,
    application: { ready: ok },
    environment: process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production" ? process.env.VERCEL_ENV : "development",
    database: { connected: db.connected, migrated: db.migrated, provider: databaseKind() },
    storage,
    media,
    rateLimit,
    sync: { transport: syncTransport() },
    ai,
  };
}
