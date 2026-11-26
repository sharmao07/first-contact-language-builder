import { json, readToken, run } from "@/lib/api/handlers";
import {
  approveExperimentPlan,
  editExperimentPlan,
  lockExperimentReply,
  recordExperimentOutcome,
  rejectExperimentPlan,
  replyToExperimentPlan,
  requestExperimentPlans,
} from "@/lib/domain/plans";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { planActionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return run(async () => {
    const { code } = await context.params;
    const token = readToken(request);
    const input = planActionSchema.parse(await request.json());
    if (input.action === "request") {
      const limit = await enforceRateLimit({ action: "ai_plan", request, code, token });
      return json(await requestExperimentPlans(code, token, input), 200, {
        "X-RateLimit-Limit": String(limit.limit),
        "X-RateLimit-Remaining": String(limit.remaining),
        "X-RateLimit-Reset": String(limit.resetAtSeconds),
      });
    }
    if (input.action === "reject") return json(await rejectExperimentPlan(code, token, input.proposalId));
    if (input.action === "edit") return json(await editExperimentPlan(code, token, input));
    if (input.action === "approve") return json(await approveExperimentPlan(code, token, input));
    if (input.action === "reply") return json(await replyToExperimentPlan(code, token, input));
    if (input.action === "lock") return json(await lockExperimentReply(code, token, input.proposalId));
    return json(await recordExperimentOutcome(code, token, input));
  });
}
