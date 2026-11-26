import { json, readToken, run } from "@/lib/api/handlers";
import { applyCommunityAction } from "@/lib/domain/community";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { communityActionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string }> };

export function POST(request: Request, context: Context) {
  return run(async () => {
    const { code } = await context.params;
    const token = readToken(request);
    const input = communityActionSchema.parse(await request.json());
    if (input.action === "propose") {
      const limit = await enforceRateLimit({ action: "ai_plan", request, code, token });
      return json(await applyCommunityAction(code, token, input), 200, {
        "X-RateLimit-Limit": String(limit.limit),
        "X-RateLimit-Remaining": String(limit.remaining),
        "X-RateLimit-Reset": String(limit.resetAtSeconds),
      });
    }
    return json(await applyCommunityAction(code, token, input));
  });
}
