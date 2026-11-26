import { json, readToken, run } from "@/lib/api/handlers";
import { analyzeEvidence } from "@/lib/domain/discovery";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { analyzeSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    const token = readToken(request);
    const limit = await enforceRateLimit({ action: "ai_plan", request, code, token });
    const input = analyzeSchema.parse(await request.json());
    return json(await analyzeEvidence(code, token, input.evidenceId), 200, {
      "X-RateLimit-Limit": String(limit.limit),
      "X-RateLimit-Remaining": String(limit.remaining),
      "X-RateLimit-Reset": String(limit.resetAtSeconds),
    });
  });
}
