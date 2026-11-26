import { json, run } from "@/lib/api/handlers";
import { rejoinSession } from "@/lib/domain/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rejoinSessionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return run(async () => {
    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const rawCode = typeof raw?.code === "string" ? raw.code : null;
    const rawToken = typeof raw?.token === "string" ? raw.token : null;
    const limit = await enforceRateLimit({ action: "session_rejoin", request, code: rawCode, token: rawToken });
    const input = rejoinSessionSchema.parse(raw);
    return json(await rejoinSession(input), 200, {
      "X-RateLimit-Limit": String(limit.limit),
      "X-RateLimit-Remaining": String(limit.remaining),
      "X-RateLimit-Reset": String(limit.resetAtSeconds),
    });
  });
}
