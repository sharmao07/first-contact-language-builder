import { getAIMode } from "@/lib/ai/config";
import { prisma } from "@/lib/database/prisma";
import { mediaSigningStatus } from "@/lib/media/sign";
import { databaseKind, storageStatus, type StorageStatus } from "@/lib/storage";
import { syncTransport } from "@/lib/sync/transport";

export type HealthReport = {
  ok: boolean;
  mode: "demo" | "openai";
  application: { ready: boolean };
  environment: string;
  database: { connected: boolean; provider: "sqlite" | "postgresql" | "unknown" };
  storage: StorageStatus;
  media: { configured: boolean; detail: string };
  sync: { transport: "stream" | "poll" };
  ai: { mode: "demo" | "openai"; configured: boolean; available: boolean; detail: string };
};

async function probeDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
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
  const [connected, storage, ai] = await Promise.all([probeDatabase(), storageStatus(), probeAI()]);
  const media = mediaSigningStatus();
  const ok = connected && storage.configured && storage.available && storage.persistent && media.configured;
  return {
    ok,
    mode: ai.mode,
    application: { ready: ok },
    environment: process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production" ? process.env.VERCEL_ENV : "development",
    database: { connected, provider: databaseKind() },
    storage,
    media,
    sync: { transport: syncTransport() },
    ai,
  };
}
