import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/http";

const DATABASE_CODES = new Set(["P1000", "P1001", "P1003", "P1010", "P1011", "P1017", "P2021"]);

export function redactSecrets(message: string) {
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/file:\S+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]");
}

export function databaseUnavailable(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return name.includes("PrismaClientInitializationError") || DATABASE_CODES.has(code);
}

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, ...(headers ? { headers } : {}) });
}

export function readToken(request: Request) {
  return request.headers.get("x-participant-token");
}

export async function run(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status, error.headers);
    if (error instanceof ZodError) {
      const message = error.issues.map((issue) => issue.message).join(" ");
      return json({ error: message || "Invalid input." }, 400);
    }
    if (databaseUnavailable(error)) {
      console.error("Database unavailable.");
      return json({ error: "The database is not available." }, 503);
    }
    console.error(error instanceof Error ? redactSecrets(error.message) : "Unexpected server error.");
    return json({ error: "Unexpected server error." }, 500);
  }
}
