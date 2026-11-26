import { json, readToken, run } from "@/lib/api/handlers";
import { createSession, listSessionsForToken } from "@/lib/domain/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSessionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return run(async () => json({ sessions: await listSessionsForToken(readToken(request)) }));
}

export function POST(request: Request) {
  return run(async () => {
    const limit = await enforceRateLimit({ action: "session_create", request });
    const input = createSessionSchema.parse(await request.json());
    return json(await createSession(input), 201, {
      "X-RateLimit-Limit": String(limit.limit),
      "X-RateLimit-Remaining": String(limit.remaining),
      "X-RateLimit-Reset": String(limit.resetAtSeconds),
    });
  });
}
