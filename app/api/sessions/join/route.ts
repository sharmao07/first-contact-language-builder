import { json, run } from "@/lib/api/handlers";
import { joinSession } from "@/lib/domain/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { joinSessionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => {
    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const rawCode = typeof raw?.code === "string" ? raw.code : null;
    const limit = await enforceRateLimit({ action: "session_join", request, code: rawCode });
    const input = joinSessionSchema.parse(raw);
    return json(await joinSession(input), 200, {
      "X-RateLimit-Limit": String(limit.limit),
      "X-RateLimit-Remaining": String(limit.remaining),
      "X-RateLimit-Reset": String(limit.resetAtSeconds),
    });
  });
}
